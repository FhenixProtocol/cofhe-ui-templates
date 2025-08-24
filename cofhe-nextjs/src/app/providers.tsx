'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { PrivyProvider } from '@privy-io/react-auth'
import { wagmiConfig } from './wagmi.config'
import { ReactNode } from 'react'

const queryClient = new QueryClient()

export function Providers({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'your-app-id-here'}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
        supportedChains: [
          {
            id: 11155111, // Sepolia
            name: 'Sepolia',
            network: 'sepolia',
            nativeCurrency: {
              name: 'Sepolia ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: ['https://rpc.sepolia.org'],
              },
            },
            blockExplorers: {
              default: {
                name: 'Etherscan',
                url: 'https://sepolia.etherscan.io',
              },
            },
          },
          {
            id: 421614, // Arbitrum Sepolia
            name: 'Arbitrum Sepolia',
            network: 'arbitrum-sepolia',
            nativeCurrency: {
              name: 'Arbitrum Sepolia ETH',
              symbol: 'ETH',
              decimals: 18,
            },
            rpcUrls: {
              default: {
                http: ['https://sepolia-rollup.arbitrum.io/rpc'],
              },
            },
            blockExplorers: {
              default: {
                name: 'Arbiscan',
                url: 'https://sepolia.arbiscan.io',
              },
            },
          },
        ],
      }}
    >
      <WagmiProvider config={wagmiConfig}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProvider>
    </PrivyProvider>
  )
} 