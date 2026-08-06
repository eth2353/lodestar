import {describe, expect, it} from "vitest";
import {routes} from "@lodestar/api";
import {ExecutionEngineHttp, defaultExecutionEngineHttpOpts} from "../../../src/execution/engine/http.js";
import {ExecutionEngineMockJsonRpcClient} from "../../../src/execution/engine/utils.js";
import {getMockedLogger} from "../../mocks/loggerMock.js";

describe("ExecutionEngineHttp client version", () => {
  it("retries client identification after an initial failure", async () => {
    let requestCount = 0;
    const method = "engine_getClientVersionV1";
    const rpc = new ExecutionEngineMockJsonRpcClient({
      handlers: {
        [method]: () => {
          requestCount++;
          if (requestCount === 1) throw Error("not ready");

          return [
            {
              code: routes.node.ClientCode.GE,
              name: "geth",
              version: "1.16.0",
              commit: "0x12345678",
            },
          ];
        },
      },
    });
    const engine = new ExecutionEngineHttp(
      rpc,
      {signal: new AbortController().signal, logger: getMockedLogger()},
      defaultExecutionEngineHttpOpts
    );

    await expect(engine.getClientVersion()).rejects.toThrow("not ready");
    await expect(engine.getClientVersion()).resolves.toEqual({
      code: routes.node.ClientCode.GE,
      name: "geth",
      version: "1.16.0",
      commit: "12345678",
    });
    expect(requestCount).toBe(2);
  });
});
