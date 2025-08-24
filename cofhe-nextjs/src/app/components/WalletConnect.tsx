'use client'

import { usePrivy } from '@privy-io/react-auth'
import { useAccount } from 'wagmi'
import { useChainId } from 'wagmi'
import { useEffect, useState } from 'react'
import { useSmartWallet } from '../hooks/useSmartWallet'

const CHAIN_NAMES: { [key: number]: string } = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia',
  42161: 'Arbitrum One',
  421614: 'Arbitrum Sepolia',
}

export function WalletConnect() {
  const { login, logout, ready, authenticated, user } = usePrivy()
  const { address } = useAccount()
  const chainId = useChainId()
  const { smartAccountAddress, isLoading: smartWalletLoading, isReady: smartWalletReady, sendSponsoredTransaction } = useSmartWallet()
  const [mounted, setMounted] = useState(false)
  const [testTxLoading, setTestTxLoading] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted || !ready) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  const handleTestSponsoredTx = async () => {
    if (!smartWalletReady) return
    
    setTestTxLoading(true)
    try {
      // Simple test transaction - send 0 ETH to self with some data
      await sendSponsoredTransaction(
        smartAccountAddress as `0x${string}`,
        '0x',
        BigInt(0)
      )
      alert('Sponsored transaction sent successfully!')
    } catch (error) {
      console.error('Failed to send sponsored transaction:', error)
      alert('Failed to send sponsored transaction. Check console for details.')
    } finally {
      setTestTxLoading(false)
    }
  }



  if (authenticated) {
    return (
      <div className="flex flex-col gap-4">
        <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
          <p><strong>User ID:</strong> {user?.id}</p>
          {address && <p><strong>EOA Wallet:</strong> {address}</p>}
          {smartAccountAddress && (
            <p><strong>Smart Wallet:</strong> {smartAccountAddress}</p>
          )}
          {chainId && <p><strong>Network:</strong> {CHAIN_NAMES[chainId] || `Unknown (${chainId})`}</p>}
          <div className="flex items-center gap-2">
            <strong>Smart Wallet Status:</strong>
            {smartWalletLoading ? (
              <span className="text-yellow-600">Loading...</span>
            ) : smartWalletReady ? (
              <span className="text-green-600">Ready</span>
            ) : (
              <span className="text-red-600">Not Ready</span>
            )}
          </div>
        </div>
        
        <div className="flex gap-2">
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
          >
            Logout
          </button>
          
          {smartWalletReady && (
            <button
              onClick={handleTestSponsoredTx}
              disabled={testTxLoading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors disabled:bg-gray-400"
            >
              {testTxLoading ? 'Sending...' : 'Test Sponsored Tx'}
            </button>
          )}
        </div>
        
        {smartWalletReady && (
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Smart wallet is ready for sponsored transactions via Pimlico paymaster
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={login}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Login with Privy
      </button>
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Connect with email, phone, or social login
      </p>
    </div>
  )
} 