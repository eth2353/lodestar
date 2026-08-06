import {describe, expect, it, vi} from "vitest";
import {routes} from "@lodestar/api";
import {getNodeApi} from "../../../../../src/api/impl/node/index.js";
import {ApiModules} from "../../../../../src/api/impl/types.js";
import {ApiOptions} from "../../../../../src/api/options.js";
import {ClientCode} from "../../../../../src/execution/index.js";

describe("node api implementation", () => {
  it("fetches the execution client version when it is not cached", async () => {
    const executionClient = {
      code: ClientCode.GE,
      name: "geth",
      version: "1.16.0",
      commit: "12345678",
    };
    const getClientVersion = vi.fn().mockResolvedValue(executionClient);
    const api = getNodeApi(
      {version: "dev"} as ApiOptions,
      {
        chain: {executionEngine: {clientVersion: null, getClientVersion}},
        network: {},
        sync: {},
      } as unknown as Pick<ApiModules, "chain" | "network" | "sync">
    );

    const {data} = await api.getNodeVersionV2();

    expect(getClientVersion).toHaveBeenCalledOnce();
    expect(data.executionClient).toEqual({
      ...executionClient,
      commit: "0x12345678",
    } satisfies routes.node.ClientVersion);
  });
});
