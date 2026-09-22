/** 显示装饰绝不修改规范状态、片段、组成部分或结果。 */
export class BattleDisplay {
    constructor(players, loadIcon, nicknameForKey = () => "") {
        this.roots = new Map(players.map(player => [player.id, player]));
        this.loadIcon = loadIcon;
        this.nicknameForKey = nicknameForKey;
        this.iconClasses = new Map();
        this.iconBase64 = new Map();
    }

    nickname(actor) {
        if (actor.minion_kind != null && actor.minion_kind !== "clone") return "";
        const root = this.roots.get(actor.id) ?? this.roots.get(actor.owner_id) ?? actor;
        return this.nicknameForKey(root.id_name ?? root.display_name ?? "");
    }

    state(actor) {
        const iconKey = actor.icon_key ?? actor.id_name ?? `#${actor.id}`;
        if (!this.iconClasses.has(iconKey)) {
            const icon = this.loadIcon(iconKey);
            this.iconClasses.set(iconKey, this.iconClasses.size + 1);
            this.iconBase64.set(iconKey, icon);
        }
        return {
            ...actor,
            _raw_display_name: actor._raw_display_name ?? actor.display_name,
            display_name: this.nickname(actor) || actor._raw_display_name || actor.display_name,
            icon_class_id: this.iconClasses.get(iconKey),
        };
    }

    states(states) { return (states ?? []).map(state => this.state(state)); }

    frame(frame) {
        const states = this.states(frame.states);
        const stateById = new Map(states.map(state => [state.id, state]));
        return {
            ...frame, states,
            rows: (frame.rows ?? []).map(row => ({
                ...row,
                clips: (row.clips ?? []).map(clip => {
                    const sidebar = this.states(clip.sidebar_states);
                    const byId = new Map([...stateById, ...sidebar.map(state => [state.id, state])]);
                    return {
                        ...clip,
                        sidebar_states: sidebar,
                        sidebar_previous_states: this.states(clip.sidebar_previous_states ?? clip.sidebar_states),
                        parts: (clip.parts ?? []).map(part => {
                            const actor = byId.get(part.player_id) ?? this.roots.get(part.player_id);
                            const nickname = part.kind === "player" && actor ? this.nickname(actor) : "";
                            return nickname ? { ...part, text: nickname } : { ...part };
                        }),
                    };
                }),
            })),
        };
    }

    battle(battle) {
        return {
            ...battle,
            players: this.states(battle.players),
            initial_states: this.states(battle.initial_states),
            final_states: this.states(battle.final_states),
        };
    }

    iconEntries() {
        return [...this.iconClasses].map(([key, id]) => ({
            icon_class_id: id, icon_png_base64: this.iconBase64.get(key),
        }));
    }
}
