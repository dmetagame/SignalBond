import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { arcCanteen } from "./contract";

export const signalBondWagmiConfig = createConfig({
  chains: [arcCanteen],
  connectors: [injected()],
  transports: {
    [arcCanteen.id]: http(arcCanteen.rpcUrls.default.http[0]),
  },
});
