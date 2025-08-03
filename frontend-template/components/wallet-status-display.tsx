"use client";

import { useManteiaWallet, walletHelpers } from "@/providers/manteia-wallet-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  ChevronDown,
  Copy,
  ExternalLink,
  LogOut,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { WalletConnectDialog } from "./wallet-connect-dialog";

/**
 * Wallet Status Display Component
 * Shows connected wallet information and provides quick actions
 * Following Design.json specifications for consistent styling
 */

export function WalletStatusDisplay() {
  const { sui, ethereum, isAnyWalletConnected, areBothWalletsConnected } = useManteiaWallet();

  // Copy address to clipboard
  const copyToClipboard = async (address: string, label: string) => {
    try {
      await navigator.clipboard.writeText(address);
      // You could add a toast notification here
      console.log(`${label} address copied to clipboard`);
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  // If no wallets connected, show connect button
  if (!isAnyWalletConnected) {
    return <WalletConnectDialog />;
  }

  // Single wallet connected - show compact view
  if (isAnyWalletConnected && !areBothWalletsConnected) {
    const connectedWallet = sui.connected ? "sui" : "ethereum";
    const address = sui.connected ? sui.account?.address : ethereum.wallet.address;
    const network = sui.connected
      ? walletHelpers.getSuiNetworkName(sui.chain?.name)
      : walletHelpers.getNetworkName(ethereum.wallet.chainId);

    return (
      <div className="flex items-center gap-2">
        <WalletConnectDialog
          trigger={
            <Button variant="outline" size="sm" className="flex items-center gap-2">
              <AlertCircle className="h-3 w-3 text-yellow-500" />
              <span className="hidden sm:inline">Connect {connectedWallet === "sui" ? "Ethereum" : "Sui"}</span>
            </Button>
          }
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs">
                  {connectedWallet === "sui" ? "S" : "E"}
                </AvatarFallback>
              </Avatar>
              <span className="hidden sm:inline font-mono text-sm">
                {walletHelpers.formatAddress(address)}
              </span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${
                connectedWallet === "sui" ? "bg-blue-500" : "bg-purple-500"
              }`} />
              {connectedWallet === "sui" ? "Sui Wallet" : "Ethereum Wallet"}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <div className="p-2 space-y-2">
              <div className="text-xs text-muted-foreground">
                <p>Network: {network}</p>
                <p className="font-mono break-all">{address}</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => copyToClipboard(address || "", `${connectedWallet} wallet`)}
              className="flex items-center gap-2"
            >
              <Copy className="h-3 w-3" />
              Copy Address
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => {
                const baseUrl = connectedWallet === "sui"
                  ? "https://suiscan.xyz"
                  : ethereum.wallet.chainId === 1
                    ? "https://etherscan.io"
                    : "https://sepolia.etherscan.io";
                window.open(`${baseUrl}/address/${address}`, '_blank');
              }}
              className="flex items-center gap-2"
            >
              <ExternalLink className="h-3 w-3" />
              View on Explorer
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                if (connectedWallet === "sui") {
                  sui.disconnect();
                } else {
                  ethereum.wallet.disconnect();
                }
              }}
              className="flex items-center gap-2 text-red-600 dark:text-red-400"
            >
              <LogOut className="h-3 w-3" />
              Disconnect
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  }

  // Both wallets connected - show full status
  return (
    <div className="flex items-center gap-2">
      <Badge
        variant="secondary"
        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hidden sm:flex items-center gap-1"
      >
        <CheckCircle2 className="h-3 w-3" />
        Cross-chain Ready
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <div className="flex -space-x-1">
              <Avatar className="h-5 w-5 border border-background">
                <AvatarFallback className="text-xs bg-blue-500 text-white">S</AvatarFallback>
              </Avatar>
              <Avatar className="h-5 w-5 border border-background">
                <AvatarFallback className="text-xs bg-purple-500 text-white">E</AvatarFallback>
              </Avatar>
            </div>
            <span className="hidden sm:inline">2 Wallets</span>
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-80">
          <DropdownMenuLabel className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Connected Wallets
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {/* Sui Wallet Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-blue-500 text-white">S</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">Sui Wallet</p>
                <p className="text-xs text-muted-foreground">
                  {walletHelpers.getSuiNetworkName(sui.chain?.name)}
                </p>
              </div>
            </div>
            <div className="pl-8">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {sui.account?.address}
              </p>
              <div className="flex gap-1 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyToClipboard(sui.account?.address || "", "Sui")}
                >
                  <Copy className="h-2 w-2 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => window.open(`https://suiscan.xyz/address/${sui.account?.address}`, '_blank')}
                >
                  <ExternalLink className="h-2 w-2 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </div>

          <Separator />

          {/* Ethereum Wallet Info */}
          <div className="p-3 space-y-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6">
                <AvatarFallback className="text-xs bg-purple-500 text-white">E</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="text-sm font-medium">Ethereum Wallet</p>
                <p className="text-xs text-muted-foreground">
                  {walletHelpers.getNetworkName(ethereum.wallet.chainId)}
                </p>
              </div>
            </div>
            <div className="pl-8">
              <p className="text-xs font-mono text-muted-foreground break-all">
                {ethereum.wallet.address}
              </p>
              <div className="flex gap-1 mt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => copyToClipboard(ethereum.wallet.address || "", "Ethereum")}
                >
                  <Copy className="h-2 w-2 mr-1" />
                  Copy
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    const baseUrl = ethereum.wallet.chainId === 1
                      ? "https://etherscan.io"
                      : "https://sepolia.etherscan.io";
                    window.open(`${baseUrl}/address/${ethereum.wallet.address}`, '_blank');
                  }}
                >
                  <ExternalLink className="h-2 w-2 mr-1" />
                  View
                </Button>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <WalletConnectDialog
              trigger={
                <button className="w-full flex items-center gap-2 px-2 py-1.5 text-sm">
                  <Wallet className="h-3 w-3" />
                  Manage Wallets
                </button>
              }
            />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}