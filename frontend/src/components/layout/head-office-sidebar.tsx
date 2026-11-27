"use client";

import { useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut } from "lucide-react";
import { toast } from "sonner";
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
import { openHeadOfficeSchoolWorkspaceAction } from "@/features/head-office-portal/actions";
import {
  headOfficeNavGroups,
  isHeadOfficeNavActive,
} from "@/features/head-office-portal/navigation";
import type { HeadOfficeAccount } from "@/types/head-office-portal";

/**
 * Same sidebar for portfolio and school workspace — only the content area changes.
 */
export function HeadOfficeSidebar({
  office,
  selectedSchoolId,
}: {
  office: HeadOfficeAccount;
  selectedSchoolId?: string | null;
}) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const [pending, startTransition] = useTransition();
  const initials = office.name.slice(0, 2).toUpperCase();

  function openSection(schoolPath: string) {
    if (!selectedSchoolId) {
      toast.message("Select a school", {
        description: "Use the school switcher at the top, then open this section.",
      });
      return;
    }
    startTransition(async () => {
      const result = await openHeadOfficeSchoolWorkspaceAction(selectedSchoolId, schoolPath);
      if (result && !result.ok) toast.error(result.message);
    });
  }

  return (
    <Sidebar collapsible="icon" side={isMobile ? "right" : "left"}>
      {!isMobile && (
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                size="lg"
                render={<Link href="/head-office" />}
                className="hover:bg-transparent active:bg-transparent"
              >
                <span className="flex aspect-square size-8 items-center justify-center rounded-lg bg-white text-brand-800">
                  <BrandBars className="h-4 w-4" />
                </span>
                <span className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-heading font-bold text-white">Vitaran Learning</span>
                  <span className="truncate text-xs text-brand-400">Head office</span>
                </span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
      )}

      <SidebarContent>
        {headOfficeNavGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel className="text-brand-400">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isSchoolSection = Boolean(item.schoolPath);
                  return (
                    <SidebarMenuItem key={item.href}>
                      {isSchoolSection ? (
                        <SidebarMenuButton
                          tooltip={
                            selectedSchoolId
                              ? item.title
                              : `${item.title} — select a school first`
                          }
                          isActive={isHeadOfficeNavActive(item.href, pathname)}
                          disabled={pending}
                          onClick={() => {
                            isMobile && setOpenMobile(false);
                            openSection(item.schoolPath!);
                          }}
                          className="transition-colors duration-150 data-active:bg-white data-active:font-semibold data-active:text-brand-900"
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      ) : (
                        <SidebarMenuButton
                          tooltip={item.title}
                          isActive={isHeadOfficeNavActive(item.href, pathname)}
                          onClick={() => isMobile && setOpenMobile(false)}
                          render={<Link href={item.href} />}
                          className="transition-colors duration-150 data-active:bg-white data-active:font-semibold data-active:text-brand-900"
                        >
                          <item.icon />
                          <span>{item.title}</span>
                        </SidebarMenuButton>
                      )}
                    </SidebarMenuItem>
                  );
                })}
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
                    className="data-open:bg-sidebar-accent data-open:text-sidebar-accent-foreground"
                  >
                    <Avatar className="size-8 rounded-lg">
                      <AvatarFallback className="rounded-lg bg-brand-700 text-xs text-white">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid flex-1 text-left text-sm leading-tight">
                      <span className="truncate font-semibold">{office.name}</span>
                      <span className="truncate text-xs">{office.code}</span>
                    </span>
                    <ChevronsUpDown className="ml-auto size-4" />
                  </SidebarMenuButton>
                }
              />
              <DropdownMenuContent
                className="min-w-56 rounded-lg"
                side={isMobile ? "bottom" : "right"}
                align="end"
                sideOffset={4}
              >
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="p-0 font-normal">
                    <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                      <Avatar className="size-8 rounded-lg">
                        <AvatarFallback className="rounded-lg">{initials}</AvatarFallback>
                      </Avatar>
                      <div className="grid flex-1 text-left text-sm leading-tight">
                        <span className="truncate font-semibold">{office.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {office.accountEmail ?? office.contactEmail}
                        </span>
                      </div>
                    </div>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  disabled={pending}
                  onClick={() => startTransition(() => void headOfficeLogout())}
                >
                  <LogOut />
                  Sign out
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
