import {describe, expect, it} from "vitest";
import {toHex} from "@lodestar/utils";
import {
  ClientDataConsensusClient,
  ClientDataExecutionClient,
  ClientDataSetup,
  DEFAULT_CLIENT_DATA,
  encodeClientData,
} from "../../../src/util/clientData.js";

describe("encodeClientData", () => {
  it("encodes the EIP-8359 reference example", () => {
    const clientData = encodeClientData({
      version: 1,
      setup: ClientDataSetup.Vero,
      threshold: 3,
      clientPairs: [
        {consensus: ClientDataConsensusClient.Teku, execution: ClientDataExecutionClient.Nethermind},
        {consensus: ClientDataConsensusClient.Lodestar, execution: ClientDataExecutionClient.Geth},
        {consensus: ClientDataConsensusClient.Nimbus, execution: ClientDataExecutionClient.Nethermind},
        {consensus: ClientDataConsensusClient.Lighthouse, execution: ClientDataExecutionClient.Besu},
      ],
    });

    expect(toHex(clientData)).toBe("0x0133876677530000000000000000000000000000000000000000000000000000");
  });

  it("defaults to simple Lodestar client data with an unknown execution client", () => {
    expect(toHex(DEFAULT_CLIENT_DATA)).toBe("0x0119610000000000000000000000000000000000000000000000000000000000");
  });

  it("rejects values that do not fit the encoding", () => {
    expect(() =>
      encodeClientData({version: 256, setup: ClientDataSetup.Simple, threshold: 1, clientPairs: []})
    ).toThrow("Invalid client data version");
    expect(() =>
      encodeClientData({
        version: 1,
        setup: ClientDataSetup.Simple,
        threshold: 1,
        clientPairs: Array.from({length: 15}, () => ({
          consensus: ClientDataConsensusClient.Lodestar,
          execution: ClientDataExecutionClient.Undefined,
        })),
      })
    ).toThrow("Too many client data pairs");
  });
});
