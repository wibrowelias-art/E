"use client";

import { GUILDS } from "@/data/guilds";
import { useLounge } from "@/lib/store";
import { GuildGlyph, LoungeMark } from "./Brand";
import { BubbleIcon, CompassIcon, PlusCircleFill, PlusIcon } from "./icons";

export function ServerRail() {
  const guildId = useLounge((s) => s.guildId);
  const selectGuild = useLounge((s) => s.selectGuild);
  const readState = useLounge((s) => s.readState);

  return (
    <div className="rail scroll-none" aria-label="Servers">
      <div className="rail__item">
        <span className="rail__pill" />
        <button className="rail__btn rail__btn--home" title="Direct messages" aria-label="Direct messages">
          <span className="md:hidden">
            <BubbleIcon size={29} />
          </span>
          <span className="max-md:hidden">
            <LoungeMark size={24} />
          </span>
        </button>
      </div>
      <div className="rail__divider" />
      {GUILDS.map((g) => {
        const unread = g.channels.some((c) => readState[c.id]?.unread);
        const mentions = g.channels.reduce((n, c) => n + (readState[c.id]?.mentions ?? 0), 0);
        const selected = g.id === guildId;
        return (
          <div key={g.id} className="rail__item" data-selected={selected} data-unread={!selected && unread}>
            <span className="rail__pill" />
            <button
              className="rail__btn rail__btn--guild"
              title={g.name}
              aria-label={g.name}
              aria-current={selected ? "page" : undefined}
              onClick={() => selectGuild(g.id)}
            >
              <span className="block h-full w-full [&>svg]:h-full [&>svg]:w-full">
                <GuildGlyph guild={g} size={48} />
              </span>
            </button>
            {!selected && mentions > 0 && <span className="rail__badge">{mentions}</span>}
          </div>
        );
      })}
      <div className="rail__item">
        <button className="rail__btn" title="Add a server" aria-label="Add a server">
          <span className="md:hidden" style={{ ["--icon-cutout" as string]: "var(--bg-rail-button)" }}>
            <PlusCircleFill size={24} />
          </span>
          <span className="max-md:hidden">
            <PlusIcon size={22} />
          </span>
        </button>
      </div>
      <div className="rail__item max-md:hidden">
        <button className="rail__btn" title="Discover" aria-label="Discover">
          <CompassIcon size={22} />
        </button>
      </div>
    </div>
  );
}
