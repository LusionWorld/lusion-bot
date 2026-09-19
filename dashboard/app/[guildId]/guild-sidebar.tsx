"use client";

import { usePathname } from "next/navigation";
import type { DiscordGuild } from "@/lib/discord";
import { guildIconUrl } from "@/lib/discord";

type NavItem = {
  href: string;
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  soon?: boolean;
};

const NAV_SECTIONS: { label: string; items: NavItem[] }[] = [
  {
    label: "Geral",
    items: [{ href: "", label: "Visão geral", icon: HomeIcon }],
  },
  {
    label: "Módulos",
    items: [
      { href: "/tickets", label: "Tickets", icon: TicketIcon },
      { href: "/moderacao", label: "Moderação", icon: ShieldIcon },
      { href: "/convites", label: "Convites", icon: InviteIcon },
    ],
  },
];

export function GuildSidebar({
  guild,
  username,
}: {
  guild: DiscordGuild;
  username: string;
}) {
  const pathname = usePathname();
  const base = `/${guild.id}`;
  const iconUrl = guildIconUrl(guild);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 hidden w-64 flex-col border-r border-border bg-surface md:flex">
      <div className="flex items-center gap-3 border-b border-border px-5 py-4">
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className="h-8 w-8 rounded-lg" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-raised text-xs font-semibold text-text-muted">
            {guild.name.slice(0, 2).toUpperCase()}
          </div>
        )}
        <p className="truncate text-sm font-medium text-text">{guild.name}</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section) => (
          <div key={section.label} className="mb-5">
            <p className="mb-1.5 px-2 text-xs font-medium text-text-faint">{section.label}</p>
            <ul className="flex flex-col gap-0.5">
              {section.items.map((item) => {
                const href = `${base}${item.href}`;
                const active = pathname === href;
                const Icon = item.icon;
                if (item.soon) {
                  return (
                    <li key={item.href}>
                      <div className="flex cursor-not-allowed items-center justify-between rounded-lg px-2.5 py-2 text-sm text-text-faint">
                        <span className="flex items-center gap-2.5">
                          <Icon className="h-4 w-4" />
                          {item.label}
                        </span>
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[10px] text-text-faint">
                          em breve
                        </span>
                      </div>
                    </li>
                  );
                }
                return (
                  <li key={item.href}>
                    <a
                      href={href}
                      className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? "bg-accent-muted text-accent"
                          : "text-text-muted hover:bg-surface-raised hover:text-text"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <a
          href="/"
          className="mb-1 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
        >
          <BackIcon className="h-4 w-4" />
          Trocar de servidor
        </a>
        <form action="/api/auth/logout" method="post">
          <button
            type="submit"
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-text-muted transition-colors hover:bg-surface-raised hover:text-text"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair ({username})
          </button>
        </form>
      </div>
    </aside>
  );
}

function HomeIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5a.5.5 0 0 1-.5-.5V13a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3.5a.5.5 0 0 1-.5.5H4a1 1 0 0 1-1-1V9.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TicketIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M2.5 7.5a1.5 1.5 0 0 1 1.5-1.5h12a1.5 1.5 0 0 1 1.5 1.5v1a1.5 1.5 0 0 0 0 3v1a1.5 1.5 0 0 1-1.5 1.5H4A1.5 1.5 0 0 1 2.5 12.5v-1a1.5 1.5 0 0 0 0-3v-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M7.5 6v8" stroke="currentColor" strokeWidth="1.4" strokeDasharray="1.6 1.8" />
    </svg>
  );
}

function ShieldIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M10 2.5 16 4.5v4.6c0 4-2.6 6.9-6 8.4-3.4-1.5-6-4.4-6-8.4V4.5L10 2.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function InviteIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <circle cx="8" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M3 16c0-2.5 2.2-4 5-4s5 1.5 5 4M13 6.5c1.4.2 2.5 1.2 2.5 2.5M14 11c1.7.3 3 1.4 3 3.2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function BackIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M12 4 6 10l6 6"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LogoutIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 20 20" fill="none" {...props}>
      <path
        d="M8 3H4.5a1 1 0 0 0-1 1v12a1 1 0 0 0 1 1H8M13 13.5 17 10l-4-3.5M17 10H7.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
