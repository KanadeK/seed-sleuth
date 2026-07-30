import { parentPort, workerData } from "node:worker_threads";
import { pathToFileURL } from "node:url";

const adapterPromise = import(pathToFileURL(workerData.adapterPath).href).then(
  (module) => {
    const generate = module[workerData.exportName];
    if (typeof generate !== "function") {
      throw new TypeError(
        `Adapter does not export a "${workerData.exportName}" function.`,
      );
    }
    return generate;
  },
);

function serializeError(error) {
  return {
    name: error?.name ?? "Error",
    message: error?.message ?? String(error),
    stack: error?.stack ?? null,
    code: error?.code ?? null,
  };
}

parentPort.on("message", async (task) => {
  try {
    const generate = await adapterPromise;
    const worlds = [];
    for (let repeat = 0; repeat < task.repeats; repeat += 1) {
      const options = structuredClone(task.options);
      worlds.push(await generate(task.seed, options));
    }
    parentPort.postMessage({ id: task.id, ok: true, worlds });
  } catch (error) {
    parentPort.postMessage({
      id: task.id,
      ok: false,
      error: serializeError(error),
    });
  }
});
