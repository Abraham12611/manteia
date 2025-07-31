"use client";

import { useState } from "react";
import { useManteiaWallet, walletHelpers } from "@/providers/manteia-wallet-provider";
import { ConnectButton, useWallet } from "@suiet/wallet-kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Wallet, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";

/**
 * Wallet Connection Dialog Component
 * Provides unified interface for connecting both Sui and Ethereum wallets
 * Following Design.json specifications with OKLCH color system
 */

interface WalletConnectDialogProps {
  trigger?: React.ReactNode;
}

export function WalletConnectDialog({ trigger }: WalletConnectDialogProps) {
  const [open, setOpen] = useState(false);
  const { sui, ethereum, isAnyWalletConnected, areBothWalletsConnected } = useManteiaWallet();

  // Default trigger button if none provided
  const defaultTrigger = (
    <Button
      variant={isAnyWalletConnected ? "outline" : "default"}
      className="flex items-center gap-2"
    >
      <Wallet className="h-4 w-4" />
      {isAnyWalletConnected ? "Manage Wallets" : "Connect Wallets"}
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || defaultTrigger}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6" />
            Connect Wallets
          </DialogTitle>
          <DialogDescription className="text-base">
            Connect your Sui and Ethereum wallets to enable cross-chain swaps on Manteia.
            Both wallets are required for the full cross-chain experience.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-6">
          {/* Connection Status Overview */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-3 w-3 rounded-full ${
                areBothWalletsConnected
                  ? "bg-green-500"
                  : isAnyWalletConnected
                    ? "bg-yellow-500"
                    : "bg-gray-400"
              }`} />
              <span className="font-medium">
                {areBothWalletsConnected
                  ? "Both wallets connected"
                  : isAnyWalletConnected
                    ? "Partial connection"
                    : "No wallets connected"}
              </span>
            </div>
            {areBothWalletsConnected && (
              <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ready for Cross-chain
              </Badge>
            )}
          </div>

          {/* Sui Wallet Section */}
          <Card className="border-2 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-cyan-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">S</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">Sui Wallet</CardTitle>
                    <CardDescription>
                      Connect to Sui {walletHelpers.getSuiNetworkName(sui.chain?.name)} network
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {sui.connected ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {sui.connected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {walletHelpers.formatAddress(sui.account?.address)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Network</p>
                      <p className="text-xs text-muted-foreground">
                        {walletHelpers.getSuiNetworkName(sui.chain?.name)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => sui.disconnect()}
                      className="flex-1"
                    >
                      Disconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => window.open(`https://suiscan.xyz/address/${sui.account?.address}`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect your Sui wallet to access Sui-based tokens and participate in cross-chain swaps.
                  </p>
                  <ConnectButton
                    className="w-full"
                    style={{
                      width: '100%',
                      background: 'hsl(var(--primary))',
                      color: 'hsl(var(--primary-foreground))',
                      border: 'none',
                      borderRadius: 'calc(var(--radius) - 2px)',
                      padding: '0.5rem 1rem',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ethereum Wallet Section */}
          <Card className="border-2 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center">
                    <span className="text-white font-bold text-sm">E</span>
                  </div>
                  <div>
                    <CardTitle className="text-lg">Ethereum Wallet</CardTitle>
                    <CardDescription>
                      Connect to {walletHelpers.getNetworkName(ethereum.wallet.chainId)} network
                    </CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {ethereum.wallet.isConnected ? (
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Disconnected
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {ethereum.wallet.isConnected ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">Address</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {walletHelpers.formatAddress(ethereum.wallet.address)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Network</p>
                      <p className="text-xs text-muted-foreground">
                        {walletHelpers.getNetworkName(ethereum.wallet.chainId)}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => ethereum.wallet.disconnect()}
                      className="flex-1"
                    >
                      Disconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-1"
                      onClick={() => {
                        const baseUrl = ethereum.wallet.chainId === 1
                          ? "https://etherscan.io"
                          : "https://sepolia.etherscan.io";
                        window.open(`${baseUrl}/address/${ethereum.wallet.address}`, '_blank');
                      }}
                    >
                      <ExternalLink className="h-3 w-3" />
                      View
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect your Ethereum wallet (MetaMask) to access EVM-based tokens and 1inch liquidity.
                  </p>
                  <Button
                    onClick={() => ethereum.wallet.connect()}
                    disabled={ethereum.isLoading}
                    className="w-full"
                  >
                    {ethereum.isLoading ? "Connecting..." : "Connect MetaMask"}
                  </Button>
                  {ethereum.error && (
                    <p className="text-sm text-red-500 p-2 rounded bg-red-50 dark:bg-red-950">
                      {ethereum.error}
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cross-chain Status */}
          {areBothWalletsConnected && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-950 dark:to-blue-950 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                <div>
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Cross-chain Ready!
                  </p>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    You can now perform swaps between Ethereum and Sui networks.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Secure connections powered by official wallet standards
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}