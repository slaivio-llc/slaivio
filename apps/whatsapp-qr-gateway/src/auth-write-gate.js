// Drain already-started writes before clearing this session. Late socket events
// must not recreate credentials after an explicit logout.
export function createAuthWriteGate() {
  let closed = false;
  const pending = new Set();
  return {
    run(write) {
      if (closed) return Promise.resolve();
      const task = Promise.resolve().then(write);
      pending.add(task);
      const remove = () => pending.delete(task);
      task.then(remove, remove);
      return task;
    },
    async close(clear) {
      closed = true;
      await Promise.allSettled([...pending]);
      return clear();
    },
  };
}
