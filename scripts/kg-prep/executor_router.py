#!/usr/bin/env python3
"""
ExecutorRouter — dispatches an ActionCandidate to the right low-level executor.

Design principle: KG node carries `executor: str` ("bash" / "cmd" / "powershell"
/ "msfconsole" / "sliver-client" / "browser"). Router maps this string to a
concrete Executor instance that knows how to fill in the command_template
and run it.

The whole point of this layer is Bottleneck D (Tool Wrapper Scalability):
~6 executors cover 80+ techniques because most ATT&CK procedures reduce to
"run this shell-ish command in this kind of session".

Adding a new executor: subclass Executor, register in ExecutorRouter.DEFAULTS.
Most Techniques will route to BashExecutor.
"""

from __future__ import annotations
import os
import re
import shlex
import subprocess
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional


# ─── Data models ─────────────────────────────────────────────────────────────

@dataclass
class TargetContext:
    """Where the agent is attacking + how to reach it."""
    host: str                                       # e.g. "192.168.70.10"
    ssh_user: Optional[str] = None
    ssh_password: Optional[str] = None
    ssh_key_path: Optional[str] = None
    ssh_port: int = 22
    # Free-form bag the agent can fill at runtime (e.g. URLs discovered,
    # credentials cracked, etc.). Templates reference these via {key}.
    runtime_vars: dict[str, Any] = field(default_factory=dict)

    def vars(self) -> dict[str, Any]:
        return {"target_host": self.host, **self.runtime_vars}


@dataclass
class ExecutionResult:
    success: bool
    stdout: str = ""
    stderr: str = ""
    returncode: int = 0
    duration_sec: float = 0.0
    executor_name: str = ""
    skipped_reason: Optional[str] = None      # for dry-run / RoE-blocked

    @classmethod
    def skipped(cls, reason: str, executor: str = "") -> "ExecutionResult":
        return cls(success=False, skipped_reason=reason, executor_name=executor)


# ─── Template rendering ──────────────────────────────────────────────────────

_PLACEHOLDER_RE = re.compile(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}")


def render_template(template: str, vars_: dict[str, Any]) -> tuple[str, list[str]]:
    """Substitute {key} placeholders with vars values.

    Returns (rendered_command, list_of_missing_keys). If anything is missing,
    leave the placeholder intact so the caller can decide how to handle it.
    """
    if not template:
        return "", []
    missing: list[str] = []

    def replace(m: re.Match) -> str:
        key = m.group(1)
        if key in vars_:
            return str(vars_[key])
        missing.append(key)
        return m.group(0)   # leave intact

    rendered = _PLACEHOLDER_RE.sub(replace, template)
    return rendered, missing


# ─── Base Executor ───────────────────────────────────────────────────────────

class Executor(ABC):
    """One subclass per execution channel."""

    name: str = "abstract"

    @abstractmethod
    def execute(self, command: str, target: TargetContext,
                timeout: int = 60) -> ExecutionResult:
        ...

    def prepare(self, template: str, target: TargetContext,
                extra_vars: Optional[dict] = None
                ) -> tuple[str, list[str]]:
        """Render the template against target vars + extras."""
        merged = target.vars()
        if extra_vars:
            merged.update(extra_vars)
        return render_template(template, merged)


# ─── BashExecutor — SSH or local ─────────────────────────────────────────────

class BashExecutor(Executor):
    """Run command via SSH if credentials present, else as local bash.

    paramiko is imported lazily so users without it can still construct the
    router (e.g. for --dry-run).
    """
    name = "bash"

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run

    def execute(self, command: str, target: TargetContext,
                timeout: int = 60) -> ExecutionResult:
        if self.dry_run:
            return ExecutionResult.skipped(
                f"dry-run: would run on {target.host}: {command[:80]}",
                executor=self.name,
            )

        # Use SSH when ssh_user/password configured, else local.
        if target.ssh_user and target.ssh_password:
            return self._ssh(command, target, timeout)
        return self._local(command, timeout)

    def _local(self, command: str, timeout: int) -> ExecutionResult:
        t0 = time.time()
        try:
            cp = subprocess.run(command, shell=True, capture_output=True,
                                text=True, timeout=timeout)
            return ExecutionResult(
                success=cp.returncode == 0,
                stdout=cp.stdout,
                stderr=cp.stderr,
                returncode=cp.returncode,
                duration_sec=time.time() - t0,
                executor_name=self.name,
            )
        except subprocess.TimeoutExpired as e:
            return ExecutionResult(
                success=False, stderr=f"timeout after {timeout}s",
                duration_sec=time.time() - t0, executor_name=self.name,
            )

    def _ssh(self, command: str, target: TargetContext,
             timeout: int) -> ExecutionResult:
        try:
            import paramiko
        except ImportError:
            return ExecutionResult(
                success=False,
                stderr="paramiko not installed: pip install paramiko",
                executor_name=self.name,
            )
        t0 = time.time()
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            client.connect(
                target.host, port=target.ssh_port,
                username=target.ssh_user,
                password=target.ssh_password,
                key_filename=target.ssh_key_path,
                timeout=15,
            )
            stdin, stdout, stderr = client.exec_command(command, timeout=timeout)
            out = stdout.read().decode("utf-8", errors="replace")
            err = stderr.read().decode("utf-8", errors="replace")
            rc = stdout.channel.recv_exit_status()
            return ExecutionResult(
                success=rc == 0, stdout=out, stderr=err, returncode=rc,
                duration_sec=time.time() - t0, executor_name=self.name,
            )
        except Exception as e:
            return ExecutionResult(
                success=False, stderr=f"ssh error: {type(e).__name__}: {e}",
                duration_sec=time.time() - t0, executor_name=self.name,
            )
        finally:
            client.close()


# ─── CmdExecutor / PowerShellExecutor — Windows ──────────────────────────────

class CmdExecutor(Executor):
    """Windows cmd.exe via WinRM, evil-winrm-style. Stub on Linux dev hosts."""
    name = "cmd"

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run

    def execute(self, command: str, target: TargetContext,
                timeout: int = 60) -> ExecutionResult:
        if self.dry_run:
            return ExecutionResult.skipped(
                f"dry-run: would run via cmd on {target.host}: {command[:80]}",
                executor=self.name,
            )
        # Real implementation would use pywinrm; left as stub for W3.
        return ExecutionResult(
            success=False,
            stderr=("CmdExecutor not yet implemented; install pywinrm and "
                    "fill in WinRM session. Stub returns failure to surface "
                    "this in tests."),
            executor_name=self.name,
        )


class PowerShellExecutor(CmdExecutor):
    """Same WinRM channel as cmd, but invokes powershell -EncodedCommand."""
    name = "powershell"

    def execute(self, command: str, target: TargetContext,
                timeout: int = 60) -> ExecutionResult:
        # Wrap as PowerShell call so encoded-command techniques work.
        wrapped = f"powershell -NoProfile -Command {shlex.quote(command)}"
        return super().execute(wrapped, target, timeout)


# ─── Other channels: stubs to be filled in W3 ────────────────────────────────

class MsfconsoleExecutor(Executor):
    name = "msfconsole"

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run

    def execute(self, command: str, target: TargetContext,
                timeout: int = 300) -> ExecutionResult:
        if self.dry_run:
            return ExecutionResult.skipped(
                f"dry-run: msfconsole RC: {command[:80]}", executor=self.name)
        # W3: implement via msfrpc client.
        return ExecutionResult(success=False,
                               stderr="MsfconsoleExecutor stub (W3)",
                               executor_name=self.name)


class SliverExecutor(Executor):
    name = "sliver-client"

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run

    def execute(self, command: str, target: TargetContext,
                timeout: int = 120) -> ExecutionResult:
        if self.dry_run:
            return ExecutionResult.skipped(
                f"dry-run: sliver: {command[:80]}", executor=self.name)
        return ExecutionResult(success=False,
                               stderr="SliverExecutor stub (W3)",
                               executor_name=self.name)


class BrowserExecutor(Executor):
    """For out-of-band TA0042 actions (domain registration, exploit acquisition).
    Most invocations are advisory (logged for the operator) rather than auto-
    executed, since they happen on the attacker workstation."""
    name = "browser"

    def __init__(self, dry_run: bool = False) -> None:
        self.dry_run = dry_run

    def execute(self, command: str, target: TargetContext,
                timeout: int = 30) -> ExecutionResult:
        return ExecutionResult.skipped(
            f"browser action (out-of-band): {command[:120]}",
            executor=self.name,
        )


# ─── Router ─────────────────────────────────────────────────────────────────

class ExecutorRouter:
    """Single source of truth for `executor` field → instance."""

    def __init__(self, executors: Optional[dict[str, Executor]] = None,
                 default_executor: str = "bash",
                 enforce_roe: bool = True) -> None:
        self._executors = executors or {}
        self._default = default_executor
        self._enforce_roe = enforce_roe

    @classmethod
    def with_defaults(cls, dry_run: bool = False,
                      enforce_roe: bool = True) -> "ExecutorRouter":
        """Standard 6-executor stack. dry_run=True wires up the no-op fast path
        on every executor; useful for end-to-end pipeline tests without a real
        lab."""
        return cls({
            "bash":           BashExecutor(dry_run=dry_run),
            "cmd":            CmdExecutor(dry_run=dry_run),
            "powershell":     PowerShellExecutor(dry_run=dry_run),
            "msfconsole":     MsfconsoleExecutor(dry_run=dry_run),
            "sliver-client":  SliverExecutor(dry_run=dry_run),
            "browser":        BrowserExecutor(dry_run=dry_run),
        }, enforce_roe=enforce_roe)

    def register(self, name: str, executor: Executor) -> None:
        self._executors[name] = executor

    def dispatch(self, candidate, target: TargetContext,
                 extra_vars: Optional[dict] = None) -> ExecutionResult:
        """Render candidate.command_template and route to the right Executor."""
        if self._enforce_roe and candidate.roe_required:
            return ExecutionResult.skipped(
                f"RoE-gated action ({candidate.action_name}) blocked. "
                f"Set ExecutorRouter(enforce_roe=False) or remove the RoE flag "
                f"in the KG to allow execution.",
                executor="(none)",
            )

        executor_name = candidate.executor or self._default
        executor = self._executors.get(executor_name)
        if executor is None:
            return ExecutionResult(
                success=False,
                stderr=f"no executor registered for '{executor_name}'",
                executor_name=executor_name,
            )

        command, missing = executor.prepare(
            candidate.command_template or "", target, extra_vars
        )
        if missing:
            return ExecutionResult(
                success=False,
                stderr=f"missing template vars: {missing}",
                executor_name=executor_name,
            )
        if not command.strip():
            return ExecutionResult.skipped(
                f"empty command for action '{candidate.action_name}'",
                executor=executor_name,
            )
        return executor.execute(command, target)


# ─── Smoke test ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    # Synthetic candidate to exercise the rendering pipeline without Aura.
    from dataclasses import dataclass as _dc

    @_dc
    class FakeCandidate:
        action_name: str = "webshell_drop"
        executor: str = "bash"
        command_template: str = 'curl -F "file=@{shell_path}" {target_upload_url}'
        roe_required: bool = False

    target = TargetContext(
        host="192.168.70.10",
        runtime_vars={
            "shell_path": "/tmp/cmd.php",
            "target_upload_url": "http://192.168.70.10/upload",
        },
    )

    router = ExecutorRouter.with_defaults(dry_run=True)
    result = router.dispatch(FakeCandidate(), target)
    print("Result:", result)
    print("OK" if result.skipped_reason and "would run" in result.skipped_reason
          else "UNEXPECTED")
