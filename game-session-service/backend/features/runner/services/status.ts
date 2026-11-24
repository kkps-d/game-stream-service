import type {
  RunnerCommand,
  RunnerSnapshot,
  RunnerStatus,
} from '../../../../../protocol/runner.ts';

type CommandSender = (command: RunnerCommand) => Promise<boolean>;

export function createRunnerRegistry(id?: string) {
  let snapshot: RunnerSnapshot | null = null;
  let sendCommand: CommandSender | undefined;

  return {
    read(): RunnerStatus | null {
      return id ? { id, online: snapshot !== null, snapshot } : null;
    },
    connect(sender: CommandSender) {
      sendCommand = sender;
    },
    async send(command: RunnerCommand) {
      return snapshot && sendCommand ? sendCommand(command) : false;
    },
    update(next: RunnerSnapshot) {
      snapshot = next;
    },
    disconnect() {
      snapshot = null;
      sendCommand = undefined;
    },
  };
}

export type RunnerRegistry = ReturnType<typeof createRunnerRegistry>;
