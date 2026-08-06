import {describe, expect, it} from "vitest";
import {routes} from "@lodestar/api";
import {toHex} from "@lodestar/utils";
import {ClientDataService} from "../../../src/services/clientData.js";
import {ClientDataSetup} from "../../../src/util/clientData.js";
import {getApiClientStub, mockApiResponse} from "../../utils/apiStub.js";
import {ClockMock} from "../../utils/clock.js";
import {loggerVc} from "../../utils/logger.js";

describe("ClientDataService", () => {
  it("polls every configured beacon node and encodes unique client pairs", async () => {
    const clock = new ClockMock();
    const lodestar = getVersionApi("http://lodestar:9596", routes.node.ClientCode.LS, routes.node.ClientCode.GE);
    const lighthouse = getVersionApi("http://lighthouse:5052", routes.node.ClientCode.LH, routes.node.ClientCode.RH);
    const duplicate = getVersionApi("http://fallback:5052", routes.node.ClientCode.LS, routes.node.ClientCode.GE);

    const service = await ClientDataService.init(
      loggerVc,
      clock,
      [lodestar, lighthouse, duplicate],
      ClientDataSetup.Simple
    );

    expect(toHex(service.getClientData())).toBe("0x0119665900000000000000000000000000000000000000000000000000000000");
    expect(lodestar.node.getNodeVersionV2).toHaveBeenCalledOnce();
    expect(lighthouse.node.getNodeVersionV2).toHaveBeenCalledOnce();
    expect(duplicate.node.getNodeVersionV2).toHaveBeenCalledOnce();
  });

  it("refreshes the data every epoch and retains the last successful value", async () => {
    const clock = new ClockMock();
    const api = getVersionApi("http://lodestar:9596", routes.node.ClientCode.LS, routes.node.ClientCode.GE);
    const service = await ClientDataService.init(loggerVc, clock, [api], ClientDataSetup.Simple);
    const initialClientData = toHex(service.getClientData());

    api.node.getNodeVersionV2.mockRejectedValueOnce(new Error("unavailable"));
    await clock.tickEpochFns(1, new AbortController().signal);

    expect(toHex(service.getClientData())).toBe(initialClientData);
    expect(api.node.getNodeVersionV2).toHaveBeenCalledTimes(2);

    api.node.getNodeVersionV2.mockResolvedValueOnce(
      mockApiResponse({
        data: {
          beaconNode: getClientVersion(routes.node.ClientCode.LS),
          executionClient: getClientVersion(routes.node.ClientCode.NM),
        },
      })
    );
    await clock.tickEpochFns(2, new AbortController().signal);

    expect(toHex(service.getClientData())).toBe("0x0119670000000000000000000000000000000000000000000000000000000000");
  });

  it("uses unknown for a missing execution client and always sets threshold one", async () => {
    const clock = new ClockMock();
    const api = getVersionApi("http://lodestar:9596", routes.node.ClientCode.LS);

    const service = await ClientDataService.init(loggerVc, clock, [api], ClientDataSetup.Unknown);

    expect(toHex(service.getClientData())).toBe("0x0109610000000000000000000000000000000000000000000000000000000000");
  });

  it("maps unknown and unregistered client codes", async () => {
    const clock = new ClockMock();
    const unknown = getVersionApi("http://unknown:5052", routes.node.ClientCode.XX, routes.node.ClientCode.XX);
    const unregistered = getVersionApi("http://other:5052", routes.node.ClientCode.EJ, routes.node.ClientCode.TE);

    const service = await ClientDataService.init(loggerVc, clock, [unknown, unregistered], ClientDataSetup.Simple);

    expect(toHex(service.getClientData())).toBe("0x0119112200000000000000000000000000000000000000000000000000000000");
  });
});

function getVersionApi(url: string, beaconCode: routes.node.ClientCode, executionCode?: routes.node.ClientCode) {
  const api = getApiClientStub();
  Object.defineProperty(api.httpClient, "baseUrl", {value: url});
  api.node.getNodeVersionV2.mockResolvedValue(
    mockApiResponse({
      data: {
        beaconNode: getClientVersion(beaconCode),
        executionClient: executionCode === undefined ? undefined : getClientVersion(executionCode),
      },
    })
  );
  return api;
}

function getClientVersion(code: routes.node.ClientCode): routes.node.ClientVersion {
  return {code, name: code, version: "1.0.0", commit: "00000000"};
}
