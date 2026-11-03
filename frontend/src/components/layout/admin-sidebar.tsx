"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, ExternalLink, LogOut } from "lucide-react";
import { BrandBars } from "@/components/shared/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { ADMIN_LOGOUT_PATH } from "@/constants/auth";
import { broadcastAdminLogout } from "@/features/admin-auth/admin-session-guard";
import { adminNavGroups, isNavItemActive } from "@/features/admin/navigation";
import type { AdminProfile } from "@/types/auth";

export function AdminSidebar({ admin }: { admin: AdminProfile }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [signingOut, setSigningOut] = useState(false);
  const initials = admin.email.slice(0, 2).toUpperCase();

  return (
    <Sidebar collapsible="icon" side={isMobile ? "right" : "left"}>
      {!isMobile && (
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              render={<Link href="/admin" />}
              className="hover:bg-transparent active:bg-transparent"
            >
              <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-brand-800">
                <BrandBars className="h-4 w-4" />
              </span>
              <span className="grid flex-1 text-left leading-tight">
                <span className="truncate font-heading font-bold text-white">
                  Vitaran Learning
                </span>
                <span className="truncate text-xs text-brand-400">
                  Admin console
                </span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      )}

      <SidebarContent>
        {adminNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-brand-400">
              {group.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isNavItemActive(item.href, pathname)}
                      onClick={() => isMobile && setOpenMobile(false)}
                      render={<Link href={item.href} />}
                      className="transition-colors duration-150 data-active:bg-white data-active:font-semibold data-active:text-brand-900"
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton
                    size="lg"
                    className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
                  />
                }
              >
                <Avatar className="size-8 rounded-lg">
                  <AvatarFallback className="rounded-lg bg-brand-700 text-xs font-semibold text-white">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-white">
                    Administrator
                  </span>
                  <span className="truncate text-xs">{admin.email}</span>
                </span>
                <ChevronsUpDown className="ml-auto size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={8}
                className="min-w-56"
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="font-normal">
                    <span className="block text-sm font-medium text-foreground">
                      Administrator
                    </span>
                    <span className="block truncate text-xs">{admin.email}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  render={<Link href="/" target="_blank" rel="noreferrer" />}
                >
                  <ExternalLink />
                  View website
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={signingOut}
                  onClick={() => {
                    if (signingOut) return;
                    setSigningOut(true);
                    broadcastAdminLogout();
                    window.location.replace(ADMIN_LOGOUT_PATH);
                  }}
                >
                  <LogOut />
                  {signingOut ? "Signing out…" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
