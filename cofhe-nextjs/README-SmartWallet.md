# Smart Wallet Integration with Privy + Permissionless

This project now includes Smart Wallet functionality using Privy.io and Permissionless with Pimlico paymaster for sponsored transactions.

## Environment Variables Required

Create a `.env.local` file in your project root with:

```env
# Get your App ID from https://dashboard.privy.io
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id-here

# Get your API key from https://dashboard.pimlico.io
NEXT_PUBLIC_PIMLICO_API_KEY=your-pimlico-api-key-here
```

## Setup Steps

1. **Privy Dashboard Setup**:
   - Go to [https://dashboard.privy.io](https://dashboard.privy.io)
   - Create a new app or use existing one
   - Copy your App ID
   - Configure allowed origins (e.g., `http://localhost:3000`)

2. **Pimlico Dashboard Setup**:
   - Go to [https://dashboard.pimlico.io](https://dashboard.pimlico.io)
   - Create an account and get your API key
   - Enable Sepolia testnet (or your preferred chain)

3. **Run the Application**:
   ```bash
   pnpm dev
   ```

## Features

- **Multi-modal Authentication**: Email, phone, social logins, external wallets
- **Smart Wallets**: Automatically created for users without wallets
- **Sponsored Transactions**: Gas-free transactions via Pimlico paymaster
- **Account Abstraction**: ERC-4337 compatible smart accounts

## How It Works

1. Users authenticate via Privy (email, social, etc.)
2. A smart wallet is automatically created using the Simple Account factory
3. The smart wallet can send sponsored transactions (no gas required from user)
4. Regular Wagmi hooks still work for contract interactions

## Testing

Once authenticated, you'll see:
- User ID and wallet addresses
- Smart wallet status
- A "Test Sponsored Tx" button to test gasless transactions

## Network Configuration

Currently configured for Sepolia testnet. To use other networks:
1. Update the `CHAIN` constant in `useSmartWallet.ts`
2. Update the Pimlico URLs accordingly
3. Ensure your Pimlico account supports the chosen network
