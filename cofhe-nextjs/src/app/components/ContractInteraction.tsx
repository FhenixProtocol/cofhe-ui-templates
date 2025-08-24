'use client'

import { useAccount, useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { useState, useEffect } from 'react'
import { CONTRACT_ADDRESS, CONTRACT_ABI } from '../../../../contract/contract'
import { useChainId } from 'wagmi'
import { cofhejs, Encryptable, FheTypes, EncryptStep } from "cofhejs/web";
import { useCofheStore } from '../store/cofheStore'
import { useSmartWallet } from '../hooks/useSmartWallet'
import { recoverAddress, hashTypedData } from 'viem'

type SupportedChainId = '11155111' | '421614'

type LoadingState = {
  increment: boolean;
  decrement: boolean;
  reset: boolean;
  decrypt: boolean;
  getEncrypted: boolean;
  sponsoredIncrement: boolean;
  sponsoredDecrement: boolean;
  sponsoredDecrypt: boolean;
  sponsoredReset: boolean;
  getSmartWalletEncrypted: boolean;
}

export function ContractInteraction() {
  const { address, isConnected } = useAccount()
  const chainId = useChainId()
  const isInitialized = useCofheStore((state) => state.isInitialized)
  const { incrementCounter: sponsoredIncrement, decrementCounter: sponsoredDecrement, decryptCounter: sponsoredDecrypt, resetCounter: sponsoredReset, isReady: smartWalletReady, smartAccountAddress, smartWalletSigner } = useSmartWallet()
  
  const [isMounted, setIsMounted] = useState(false)
  const [unsealedValue, setUnsealedValue] = useState<string>('')
  const [smartWalletUnsealedValue, setSmartWalletUnsealedValue] = useState<string>('')
  const [hash, setHash] = useState<`0x${string}` | undefined>()
  const [resetSteps, setResetSteps] = useState<string[]>([])
  const [hoverInfo, setHoverInfo] = useState<string>('Hover over button to get information')
  const [loading, setLoading] = useState<LoadingState>({
    increment: false,
    decrement: false,
    reset: false,
    decrypt: false,
    getEncrypted: false,
    sponsoredIncrement: false,
    sponsoredDecrement: false,
    sponsoredDecrypt: false,
    sponsoredReset: false,
    getSmartWalletEncrypted: false,
  })

  const buttonDescriptions = {
    increment: 'Send transaction to increment the counter',
    decrement: 'Send transaction to decrement the counter',
    reset: 'Encrypt the value 88 and send transaction to reset the counter',
    decrypt: 'Request decryption of the counter, this will perform asynchronous decryption and store the value on chain once it is ready',
    getEncrypted: 'This will retrieve the encrypted counter value and unseal a permit. This will not trigger decryption transaction',
    sponsoredIncrement: 'Send sponsored (gasless) transaction to increment the counter via smart wallet',
    sponsoredDecrement: 'Send sponsored (gasless) transaction to decrement the counter via smart wallet',
    sponsoredDecrypt: 'Send sponsored (gasless) transaction to decrypt the counter via smart wallet',
    sponsoredReset: 'Encrypt value 88 and send sponsored (gasless) transaction to reset the counter via smart wallet',
    default: 'Hover over button to get information'
  }

  const contractAddress = chainId ? CONTRACT_ADDRESS[chainId.toString() as SupportedChainId] : undefined

  const { writeContractAsync: increment } = useWriteContract()
  const { writeContractAsync: decrement } = useWriteContract()
  const { writeContractAsync: reset } = useWriteContract()
  const { writeContractAsync: decryptCounter } = useWriteContract()

  const { data: receipt, isError } = useWaitForTransactionReceipt({
    hash,
  })

  const { data: decryptedCount, refetch: refetchDecryptedCount } = useReadContract({
    address: contractAddress as `0x${string}`,
    account: address,
    abi: CONTRACT_ABI,
    functionName: 'getDecryptedValue',
  })

  const { data: encryptedCount, refetch: refetchEncryptedCount } = useReadContract({
    address: contractAddress as `0x${string}`,
    account: address,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedValue',
  })

  // Smart wallet read contracts (for sponsored transactions)
  const { data: smartWalletDecryptedCount, refetch: refetchSmartWalletDecryptedCount } = useReadContract({
    address: contractAddress as `0x${string}`,
    account: smartAccountAddress as `0x${string}` | undefined,
    abi: CONTRACT_ABI,
    functionName: 'getDecryptedValue',
    query: {
      enabled: !!smartAccountAddress && !!contractAddress,
    },
  })

  const { data: smartWalletEncryptedCount, refetch: refetchSmartWalletEncryptedCount } = useReadContract({
    address: contractAddress as `0x${string}`,
    account: smartAccountAddress as `0x${string}` | undefined,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedValue',
    query: {
      enabled: !!smartAccountAddress && !!contractAddress,
    },
  })

  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    if (receipt) {
      console.log('Transaction Receipt:', receipt)
      setHash(undefined)
      refetchEncryptedCount()
      refetchDecryptedCount()
      setResetSteps([])
    }
  }, [receipt, refetchEncryptedCount, refetchDecryptedCount])

  useEffect(() => {
    if (receipt || isError) {
      setLoading({
        increment: false,
        decrement: false,
        reset: false,
        decrypt: false,
        getEncrypted: false,
        sponsoredIncrement: false,
        sponsoredDecrement: false,
        sponsoredDecrypt: false,
        sponsoredReset: false,
        getSmartWalletEncrypted: false,
      })
    }
  }, [receipt, isError])

  if (!isMounted || !isConnected || !contractAddress) {
    return null
  }

  const isAnyLoading = Object.values(loading).some(Boolean)

  // Helper function to extract signer address from signature (For testing purposes)
  const extractSignerAddress = async (
    signature: `0x${string}`,
    domain: any,
    types: any,
    message: any
  ): Promise<`0x${string}`> => {
    try {
      // Hash the typed data to get the message hash
      const messageHash = hashTypedData({
        domain,
        types,
        primaryType: Object.keys(types).find(key => key !== 'EIP712Domain') || Object.keys(types)[0],
        message
      })

      // Recover the address from the signature and message hash
      const recoveredAddress = await recoverAddress({
        hash: messageHash,
        signature
      })

      return recoveredAddress
    } catch (error) {
      console.error('Error extracting signer address:', error)
      throw error
    }
  }

  const handleIncrement = async () => {
    setLoading(prev => ({ ...prev, increment: true }))
    try {
      const hash = await increment({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'increment',
      })
      
      if (hash) {
        setHash(hash)
      }
    } catch (error) {
      console.error('Increment error:', error)
      setLoading(prev => ({ ...prev, increment: false }))
    }
  }

  const handleDecrement = async () => {
    setLoading(prev => ({ ...prev, decrement: true }))
    try {
      const hash = await decrement({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'decrement',
      })
      
      if (hash) {
        setHash(hash)
      }
    } catch (error) {
      console.error('Decrement error:', error)
      setLoading(prev => ({ ...prev, decrement: false }))
    }
  }

  const encryptionState = async (step: EncryptStep) => {
    console.log(step)
    setResetSteps(prev => [...prev, `Encryption Step: ${step}`])
  }

  const handleReset = async () => {
    setLoading(prev => ({ ...prev, reset: true }))
    setResetSteps(['Starting reset process...'])
    try {
      setResetSteps(prev => [...prev, 'Encrypting value 88...'])
      const encryptedValue = await cofhejs.encrypt([Encryptable.uint32("88")], encryptionState);
      console.log(encryptedValue)
      setResetSteps(prev => [...prev, 'Sending reset transaction...'])
      const hash = await reset({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'reset',
        args: [encryptedValue.data?.[0]],
      })
      
      if (hash) {
        setHash(hash)
        setResetSteps(prev => [...prev, 'Transaction sent, waiting for confirmation...'])
      }
    } catch (error) {
      console.error('Reset error:', error)
      setLoading(prev => ({ ...prev, reset: false }))
      setResetSteps(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
    }
  }

  const handleDecrypt = async () => {
    setLoading(prev => ({ ...prev, decrypt: true }))
    try {
      const hash = await decryptCounter({
        address: contractAddress as `0x${string}`,
        abi: CONTRACT_ABI,
        functionName: 'decryptCounter',
      })
      
      if (hash) {
        setHash(hash)
      }
    } catch (error) {
      console.error('Decrypt error:', error)
      setLoading(prev => ({ ...prev, decrypt: false }))
    }
  }

  const handleEncryptedValueRequest = async () => {
    setLoading(prev => ({ ...prev, getEncrypted: true }))
    try {
      await refetchEncryptedCount()
      
     
      if (encryptedCount) {
        const permit = await cofhejs.getPermit();
        const unsealResult = await cofhejs.unseal(encryptedCount as bigint, FheTypes.Uint32, address, permit.data?.getHash());
        setUnsealedValue(unsealResult?.data?.toString() ?? '');
      }
    } catch (error) {
      console.error('Get encrypted value error:', error)
    } finally {
      setLoading(prev => ({ ...prev, getEncrypted: false }))
    }
  }

  const handleSmartWalletEncryptedValueRequest = async () => {
    setLoading(prev => ({ ...prev, getSmartWalletEncrypted: true }))
      try {
        await refetchSmartWalletEncryptedCount()
      
        if (smartWalletEncryptedCount) {
          const permit = await cofhejs.getPermit();
          const unsealResult = await cofhejs.unseal(smartWalletEncryptedCount as bigint, FheTypes.Uint32, smartAccountAddress as string, permit.data?.getHash());
          setSmartWalletUnsealedValue(unsealResult?.data?.toString() ?? '');
        }
      } catch (error) {
        console.error('Get smart wallet encrypted value error:', error)
      } finally {
        setLoading(prev => ({ ...prev, getSmartWalletEncrypted: false }))
      }
  }

  // Sponsored transaction handlers
  const handleSponsoredIncrement = async () => {
    if (!smartWalletReady || !contractAddress) return
    
    setLoading(prev => ({ ...prev, sponsoredIncrement: true }))
    try {
      const result = await sponsoredIncrement(contractAddress as `0x${string}`)
      console.log('Sponsored increment result:', result)
      refetchSmartWalletEncryptedCount()
      refetchSmartWalletDecryptedCount()
    } catch (error) {
      console.error('Sponsored increment error:', error)
    } finally {
      setLoading(prev => ({ ...prev, sponsoredIncrement: false }))
    }
  }

  const handleSponsoredDecrement = async () => {
    if (!smartWalletReady || !contractAddress) return
    
    setLoading(prev => ({ ...prev, sponsoredDecrement: true }))
    try {
      const result = await sponsoredDecrement(contractAddress as `0x${string}`)
      console.log('Sponsored decrement result:', result)
      refetchSmartWalletEncryptedCount()
      refetchSmartWalletDecryptedCount()
    } catch (error) {
      console.error('Sponsored decrement error:', error)
    } finally {
      setLoading(prev => ({ ...prev, sponsoredDecrement: false }))
    }
  }

  const handleSponsoredDecrypt = async () => {
    if (!smartWalletReady || !contractAddress) return
    
    setLoading(prev => ({ ...prev, sponsoredDecrypt: true }))
    try {
      const result = await sponsoredDecrypt(contractAddress as `0x${string}`)
      console.log('Sponsored decrypt result:', result)
      
      // Transaction is confirmed, now fetch the decrypted value for smart wallet
      // Add a small delay to ensure the decryption process has completed
      setTimeout(() => {
        refetchSmartWalletDecryptedCount()
      }, 1000)
    } catch (error) {
      console.error('Sponsored decrypt error:', error)
    } finally {
      setLoading(prev => ({ ...prev, sponsoredDecrypt: false }))
    }
  }

  const handleSponsoredReset = async () => {
    if (!smartWalletReady || !contractAddress) return
    
    setLoading(prev => ({ ...prev, sponsoredReset: true }))
    setResetSteps(['Starting sponsored reset process...'])
    try {
      setResetSteps(prev => [...prev, 'Encrypting value 88...'])

      
      //cofhejs.encryptOverrideAccount(smartAccountAddress as `0x${string}`);
      const encryptedValue = await cofhejs.encrypt([Encryptable.uint32("88")], encryptionState);
      console.log('Encrypted value for sponsored reset:', encryptedValue)
      
      setResetSteps(prev => [...prev, 'Sending sponsored reset transaction...'])
      const result = await sponsoredReset(contractAddress as `0x${string}`, encryptedValue.data?.[0])
      console.log('Sponsored reset result:', result)
      
      setResetSteps(prev => [...prev, 'Sponsored transaction completed!'])
      refetchSmartWalletEncryptedCount()
      refetchSmartWalletDecryptedCount()
    } catch (error) {
      console.error('Sponsored reset error:', error)
      setResetSteps(prev => [...prev, `Error: ${error instanceof Error ? error.message : 'Unknown error'}`])
    } finally {
      setLoading(prev => ({ ...prev, sponsoredReset: false }))
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <div className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Contract Interactions</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={handleIncrement}
            disabled={!isInitialized || isAnyLoading}
            onMouseEnter={() => setHoverInfo(buttonDescriptions.increment)}
            onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
          >
            {loading.increment ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {hash ? 'Confirming...' : 'Incrementing...'}
              </span>
            ) : (
              'Increment'
            )}
          </button>
          <button
            onClick={handleDecrement}
            disabled={!isInitialized || isAnyLoading}
            onMouseEnter={() => setHoverInfo(buttonDescriptions.decrement)}
            onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
          >
            {loading.decrement ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {hash ? 'Confirming...' : 'Decrementing...'}
              </span>
            ) : (
              'Decrement'
            )}
          </button>
          <button
            onClick={handleReset}
            disabled={!isInitialized || isAnyLoading}
            onMouseEnter={() => setHoverInfo(buttonDescriptions.reset)}
            onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
            className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
          >
            {loading.reset ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {hash ? 'Confirming...' : 'Resetting...'}
              </span>
            ) : (
              'Reset'
            )}
          </button>
        </div>

        <h2 className="text-md font-semibold text-gray-800 dark:text-gray-200">Value Operations</h2>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDecrypt}
            disabled={!isInitialized || isAnyLoading}
            onMouseEnter={() => setHoverInfo(buttonDescriptions.decrypt)}
            onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
          >
            {loading.decrypt ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {hash ? 'Confirming...' : 'Decrypting...'}
              </span>
            ) : (
              'Request Decryption'
            )}
          </button>
          <button
            onClick={handleEncryptedValueRequest}
            disabled={!isInitialized || isAnyLoading}
            onMouseEnter={() => setHoverInfo(buttonDescriptions.getEncrypted)}
            onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
          >
            {loading.getEncrypted ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Getting Value...
              </span>
            ) : (
              'Get Encrypted Value'
            )}
          </button>
        </div>

      </div>

      <hr className="my-1 border-gray-200 dark:border-gray-700" />

      {smartWalletReady && (
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Sponsored Transactions (Gasless)</h3>
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleSponsoredIncrement}
              disabled={!isInitialized || isAnyLoading}
              onMouseEnter={() => setHoverInfo(buttonDescriptions.sponsoredIncrement)}
              onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative border-2 border-green-400"
            >
              {loading.sponsoredIncrement ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sponsored...
                </span>
              ) : (
                'Increment'
              )}
            </button>
            <button
              onClick={handleSponsoredDecrement}
              disabled={!isInitialized || isAnyLoading}
              onMouseEnter={() => setHoverInfo(buttonDescriptions.sponsoredDecrement)}
              onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
              className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative border-2 border-red-400"
            >
              {loading.sponsoredDecrement ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sponsored...
                </span>
              ) : (
                'Decrement'
              )}
            </button>
            <button
              onClick={handleSponsoredReset}
              disabled={!isInitialized || isAnyLoading}
              onMouseEnter={() => setHoverInfo(buttonDescriptions.sponsoredReset)}
              onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
              className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative border-2 border-yellow-400"
            >
              {loading.sponsoredReset ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sponsored...
                </span>
              ) : (
                'Reset'
              )}
            </button>
          </div>
          
          <h2 className="text-md font-semibold text-gray-800 dark:text-gray-200">Value Operations</h2>
          <div className="grid grid-cols-2 gap-3">
          <button
              onClick={handleSponsoredDecrypt}
              disabled={!isInitialized || isAnyLoading}
              onMouseEnter={() => setHoverInfo(buttonDescriptions.sponsoredDecrypt)}
              onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative border-2 border-purple-400"
            >
              {loading.sponsoredDecrypt ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Sponsored...
                </span>
              ) : (
                'Request Decryption'
              )}
            </button>
            <button
              onClick={handleSmartWalletEncryptedValueRequest}
              disabled={!isInitialized || isAnyLoading}
              onMouseEnter={() => setHoverInfo('Get encrypted counter value for smart wallet and unseal it')}
              onMouseLeave={() => setHoverInfo(buttonDescriptions.default)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm hover:shadow-md relative"
            >
              {loading.getSmartWalletEncrypted ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Getting Value...
                </span>
              ) : (
                'Get Encrypted Value'
              )}
            </button>

          </div>

          
        </div>
      )}

      <div className="flex flex-col gap-4">


        {resetSteps.length > 0 && (
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Reset Process Steps:</p>
            <ul className="space-y-1">
              {resetSteps.map((step, index) => (
                <li key={index} className="text-sm text-gray-700 dark:text-gray-300">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(decryptedCount !== undefined || unsealedValue || smartWalletDecryptedCount !== undefined || smartWalletUnsealedValue) && (
          <div className="mt-4 space-y-3">
            {decryptedCount !== undefined && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Decrypted Value (EOA Wallet)</p>
                <p className="text-lg font-mono text-gray-900 dark:text-white mt-1">{String(decryptedCount)}</p>
              </div>
            )}

            {smartWalletDecryptedCount !== undefined && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-300">⚡ Decrypted Value (Smart Wallet)</p>
                <p className="text-lg font-mono text-blue-900 dark:text-blue-100 mt-1">{String(smartWalletDecryptedCount)}</p>
              </div>
            )}

            {unsealedValue && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-300">Unsealed Value (EOA Wallet)</p>
                <p className="text-lg font-mono text-gray-900 dark:text-white mt-1">{unsealedValue}</p>
              </div>
            )}

            {smartWalletUnsealedValue && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm font-medium text-blue-600 dark:text-blue-300">⚡ Unsealed Value (Smart Wallet)</p>
                <p className="text-lg font-mono text-blue-900 dark:text-blue-100 mt-1">{smartWalletUnsealedValue}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!isInitialized && (
        <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            Please wait while CoFHE initializes...
          </p>
        </div>
      )}

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
        <p className="text-sm text-gray-700 dark:text-gray-300">{hoverInfo}</p>
      </div>
    </div>
  )
} 