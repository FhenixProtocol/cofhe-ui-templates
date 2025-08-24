import { mainnet, sepolia, arbitrum, arbitrumSepolia } from 'wagmi/chains'
import { createConfig, http } from 'wagmi'

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, arbitrum, arbitrumSepolia],
  connectors: [],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [arbitrum.id]: http(),
    [arbitrumSepolia.id]: http(),
  },
}) 