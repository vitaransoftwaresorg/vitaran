"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronsUpDown, LogOut, School } from "lucide-react";
import { RememberedNavLink } from "@/components/layout/remembered-nav-link";
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
import { headOfficeLogout } from "@/features/head-office-auth/actions";
import { leaveHeadOfficeSchoolAction } from "@/features/head-office-portal/actions";
import { schoolLogout } from "@/features/school-auth/actions";
import { isSchoolNavActive, schoolNavGroups } from "@/features/school-portal/navigation";
import type { SchoolAccount } from "@/types/school";

export function SchoolSidebar({
  school,
  fromHeadOffice = false,
}: {
  school: SchoolAccount;
  fromHeadOffice?: boolean;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [signingOut, startSignOut] = useTransition();
  const initials = school.name.slice(0, 2).toUpperCase();
  const homeHref = fromHeadOffice ? "/school" : "/school/resources";

  return (
    <Sidebar collapsible="icon" side={isMobile ? "right" : "left"}>
      {!isMobile && (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href={homeHref} />}
                className="hover:bg-transparent active:bg-transparent"
              >
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-brand-800">
                  <BrandBars className="h-4 w-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-heading font-bold text-white">Vitaran Learning</span>
                  <span className="truncate text-xs text-brand-400">
                    {fromHeadOffice ? "Head office" : "School portal"}
                  </span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      <SidebarContent>
        {fromHeadOffice ? (
          <SidebarGroup>
            <SidebarGroupLabel className="text-brand-400">Portfolio</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    tooltip="All Schools"
                    onClick={() => {
                      isMobile && setOpenMobile(false);
                      startSignOut(() => void leaveHeadOfficeSchoolAction());
                    }}
                    className="transition-colors duration-150"
                  >
                    <School />
                    <span>All Schools</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : null}

        {schoolNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-brand-400">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      tooltip={item.title}
                      isActive={isSchoolNavActive(item.href, pathname)}
                      onClick={() => isMobile && setOpenMobile(false)}
                      render={<RememberedNavLink rootHref={item.href} />}
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
                <span className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium text-white">{school.name}</span>
                  <span className="truncate text-xs">{school.code}</span>
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
                    <span className="block text-sm font-medium text-foreground">{school.name}</span>
                    <span className="block truncate text-xs">{school.accountEmail}</span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                {fromHeadOffice ? (
                  <>
                    <DropdownMenuItem
                      disabled={signingOut}
                      onClick={() => startSignOut(() => void leaveHeadOfficeSchoolAction())}
                    >
                      <Building2 />
                      {signingOut ? "Returning…" : "All Schools"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={signingOut}
                      onClick={() => startSignOut(() => void headOfficeLogout())}
                    >
                      <LogOut />
                      Sign out
                    </DropdownMenuItem>
                  </>
                ) : (
                  <DropdownMenuItem
                    variant="destructive"
                    disabled={signingOut}
                    onClick={() => startSignOut(() => void schoolLogout())}
                  >
                    <LogOut />
                    {signingOut ? "Signing out…" : "Sign out"}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
