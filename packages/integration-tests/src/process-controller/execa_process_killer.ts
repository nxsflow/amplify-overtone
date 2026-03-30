import { execa, type ResultPromise } from "execa";

export const killExecaProcess = async (processInstance: ResultPromise) => {
    if (process.platform.startsWith("win")) {
        if (typeof processInstance.pid !== "number") {
            throw new Error("Cannot kill the process that does not have pid");
        }
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try {
            await execa("taskkill", ["/pid", `${processInstance.pid}`, "/f", "/t"]);
        } catch (e) {
            const isProcessNotFoundError =
                e instanceof Error &&
                (e.message.includes("not found") ||
                    e.message.includes("There is no running instance of the task"));
            if (!isProcessNotFoundError) {
                throw e;
            }
        }
    } else {
        processInstance.kill("SIGINT");
    }
};
