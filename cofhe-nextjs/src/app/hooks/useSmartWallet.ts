"use client";

import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useEffect, useState } from "react";
import { createSmartAccountClient } from "permissionless";
import { toSafeSmartAccount } from "permissionless/accounts";
import { createPimlicoClient } from "permissionless/clients/pimlico";
import { createPublicClient, http, Address, createWalletClient, custom, encodeFunctionData } from "viem";
import { sepolia, arbitrumSepolia } from "viem/chains";
import { entryPoint07Address } from "viem/account-abstraction";
import { CONTRACT_ABI } from "../../../../contract/contract";

// Helper function to unwrap call results
function unwrapCallResult(result: any) {
    return result?.data || result;
}

// Transformer function to convert Viem clients to CoFHE-compatible format
function viemProviderSignerTransformer(viemClient: any, smartAccountClient: any) {
    const provider = {
        getChainId: async () => {
            return await viemClient.getChainId();
        },
        call: async (transaction: any) => {
            return unwrapCallResult(
                await viemClient.call({
                    ...transaction,
                })
            );
        },
        send: async (method: string, params: any[]) => {
            return await viemClient.request({ method: method as any, params: params as any });
        },
    };

    const signer = {
        getAddress: async () => {
            return smartAccountClient.account.address;
        },
        getAddresses: async () => {
            return [smartAccountClient.account.address];
        },
        signTypedData: async (typedDataOrDomain: any, types?: any, message?: any) => {
            // Check if it's called with a single object (CoFHE style) or separate parameters
            let domain, typesObj, messageObj, primaryType;
            
            if (types === undefined && message === undefined) {
                // Called with single object containing all data
                console.log("Single object format detected");
                domain = typedDataOrDomain.domain;
                typesObj = typedDataOrDomain.types;
                messageObj = typedDataOrDomain.message;
                primaryType = typedDataOrDomain.primaryType;
            } else {
                // Called with separate parameters
                console.log("Separate parameters format detected");
                domain = typedDataOrDomain;
                typesObj = types;
                messageObj = message;
                primaryType = Object.keys(typesObj).find((key) => key !== "EIP712Domain") || Object.keys(typesObj)[0];
            }
            // Use Safe smart account client for signing (Safe supports EIP-1271)
            return await smartAccountClient.signTypedData({
                domain,
                types: typesObj,
                primaryType,
                message: messageObj,
            });
        },
        provider,
        sendTransaction: async (tx: any) => {
            return await smartAccountClient.sendTransaction(tx);
        },
    };

    return {
        provider,
        signer,
    };
}

const PIMLICO_API_KEY = process.env.NEXT_PUBLIC_PIMLICO_API_KEY || "your-pimlico-api-key";

// Supported chains for smart wallet
const SUPPORTED_CHAINS = {
    [sepolia.id]: sepolia,
    [arbitrumSepolia.id]: arbitrumSepolia,
};

export function useSmartWallet() {
    const { authenticated, user } = usePrivy();
    const { wallets } = useWallets();
    const [smartAccountClient, setSmartAccountClient] = useState<any>(null);
    const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null);
    const [smartWalletSigner, setSmartWalletSigner] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!authenticated || !wallets.length) {
            setSmartAccountClient(null);
            setSmartAccountAddress(null);
            setSmartWalletSigner(null);
            return;
        }

        const initializeSmartWallet = async () => {
            try {
                setIsLoading(true);

                // Get the first wallet (you might want to let users choose)
                const wallet = wallets[0];
                console.log("wallets", wallets);

                // Get the Ethereum provider and chain ID
                const provider = await wallet.getEthereumProvider();
                const currentChainId = await provider.request({ method: 'eth_chainId' });
                const chainIdNumber = parseInt(currentChainId, 16); // Convert hex to number
                const currentChain = SUPPORTED_CHAINS[chainIdNumber as keyof typeof SUPPORTED_CHAINS];

                if (!currentChain) {
                    console.warn(`Chain ${chainIdNumber} (${currentChainId}) not supported for smart wallet. Supported chains:`, Object.keys(SUPPORTED_CHAINS));
                    return;
                }

                // Create wallet client using the provider we already have
                const walletClient = createWalletClient({
                    account: wallet.address as `0x${string}`,
                    chain: currentChain,
                    transport: custom(provider),
                });

                // Create public client
                const publicClient = createPublicClient({
                    chain: currentChain,
                    transport: http(),
                });

                // Create Pimlico client (unified bundler and paymaster)
                const pimlicoClient = createPimlicoClient({
                    transport: http(`https://api.pimlico.io/v2/${currentChain.id}/rpc?apikey=${PIMLICO_API_KEY}`),
                    entryPoint: {
                        address: entryPoint07Address,
                        version: "0.7",
                    },
                });

                // Create Safe smart account (supports EIP-1271)
                const smartAccount = await toSafeSmartAccount({
                    client: publicClient,
                    owners: [walletClient],
                    threshold: BigInt(1),
                    version: "1.4.1",
                    entryPoint: {
                        address: entryPoint07Address,
                        version: "0.7",
                    },
                });

                // Create smart account client first
                const smartAccountClient = createSmartAccountClient({
                    account: smartAccount,
                    chain: currentChain,
                    bundlerTransport: http(`https://api.pimlico.io/v2/${currentChain.id}/rpc?apikey=${PIMLICO_API_KEY}`),
                    paymaster: pimlicoClient,
                    userOperation: {
                        estimateFeesPerGas: async () => {
                            return (await pimlicoClient.getUserOperationGasPrice()).fast;
                        },
                    },
                });

                // Transform Viem clients to CoFHE-compatible format using the transformer function
                const { provider: cofheProvider, signer: cofheSigner } = viemProviderSignerTransformer(publicClient, smartAccountClient);

                setSmartAccountClient(smartAccountClient);
                setSmartAccountAddress(smartAccount.address);
                setSmartWalletSigner(cofheSigner);
            } catch (error) {
                console.error("Failed to initialize smart wallet:", error);
            } finally {
                setIsLoading(false);
            }
        };

        initializeSmartWallet();
    }, [authenticated, wallets]);

    const sendSponsoredTransaction = async (to: Address, data: `0x${string}`, value = BigInt(0)) => {
        if (!smartAccountClient) {
            throw new Error("Smart wallet not initialized");
        }

        try {
            const userOpHash = await smartAccountClient.sendUserOperation({
                calls: [
                    {
                        to,
                        data,
                        value,
                    },
                ],
            });

            console.log("User operation hash:", userOpHash);

            // Wait for the user operation to be included
            const receipt = await smartAccountClient.waitForUserOperationReceipt({
                hash: userOpHash,
            });

            console.log("Transaction receipt:", receipt);
            return receipt;
        } catch (error) {
            console.error("Failed to send sponsored transaction:", error);
            throw error;
        }
    };

    // Contract interaction helpers
    const incrementCounter = async (contractAddress: Address) => {
        const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: "increment",
        });

        return sendSponsoredTransaction(contractAddress, data);
    };

    const decrementCounter = async (contractAddress: Address) => {
        const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: "decrement",
        });

        return sendSponsoredTransaction(contractAddress, data);
    };

    const decryptCounter = async (contractAddress: Address) => {
        const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: "decryptCounter",
        });

        return sendSponsoredTransaction(contractAddress, data);
    };

    const resetCounter = async (contractAddress: Address, encryptedValue: any) => {
        console.log("-------------------------");
        console.log(encryptedValue);
        console.log("-------------------------");
        const data = encodeFunctionData({
            abi: CONTRACT_ABI,
            functionName: "reset",
            args: [encryptedValue],
        });

        return sendSponsoredTransaction(contractAddress, data);
    };

    return {
        smartAccountClient,
        smartAccountAddress,
        smartWalletSigner,
        isLoading,
        sendSponsoredTransaction,
        incrementCounter,
        decrementCounter,
        decryptCounter,
        resetCounter,
        isReady: !!smartAccountClient && !isLoading,
    };
}

// Export the transformer function for use in other components
export { viemProviderSignerTransformer };
