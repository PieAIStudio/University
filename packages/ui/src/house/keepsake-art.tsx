import type { KeepsakeArt as Art } from "@pieai/university-core";
import { useI18n } from "../i18n/index.js";

/*
 * The keepsakes, drawn flat: the house is a 2D room in the brand's flat
 * pastel look. A 3D room can later read the same placements and draw the same
 * things in the island's blocks; nothing here is needed for that.
 */
const INK = "#2a2320";

export function KeepsakeArt({ art }: { readonly art: Art }) {
  const t = useI18n();
  return (
    <svg className="keepsake-art" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      {art === "paper-plane" ? (
        <>
          <path
            d="M8 34 L56 14 L28 46 Z"
            fill="#fffdf8"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M28 46 L32 30 L56 14"
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M32 30 L8 34" fill="none" stroke={INK} strokeWidth="2" opacity=".5" />
        </>
      ) : art === "emoji-jar" ? (
        <>
          <rect
            x="14"
            y="16"
            width="36"
            height="40"
            rx="10"
            fill="#f7c948"
            stroke={INK}
            strokeWidth="3"
          />
          <rect
            x="18"
            y="8"
            width="28"
            height="10"
            rx="4"
            fill="#b39bf0"
            stroke={INK}
            strokeWidth="3"
          />
          <circle cx="26" cy="34" r="3.5" fill={INK} />
          <circle cx="38" cy="34" r="3.5" fill={INK} />
          <path
            d="M24 43 Q32 50 40 43"
            fill="none"
            stroke={INK}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </>
      ) : art === "red-pen" ? (
        <>
          <path
            d="M14 50 L44 20 L50 26 L20 56 L12 58 Z"
            fill="#f4876b"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M40 24 L46 30" stroke={INK} strokeWidth="3" />
          <path
            d="M44 20 L48 16 Q52 14 54 18 Q56 22 50 26"
            fill="#fffdf8"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </>
      ) : art === "lighthouse" ? (
        <>
          <path
            d="M24 56 L28 20 L36 20 L40 56 Z"
            fill="#fffdf8"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M25.5 44 L38.5 44 M26.8 32 L37.2 32" stroke="#f4876b" strokeWidth="5" />
          <rect
            x="24"
            y="10"
            width="16"
            height="10"
            rx="3"
            fill="#6bb3ea"
            stroke={INK}
            strokeWidth="3"
          />
          <text x="32" y="18.5" textAnchor="middle" fontSize="7" fontWeight="800" fill={INK}>
            {t.t("keepsake.lighthouse.mark")}
          </text>
          <path d="M20 56 H44" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : art === "signpost" ? (
        <>
          <path d="M30 14 V56" stroke={INK} strokeWidth="4" strokeLinecap="round" />
          <path
            d="M18 16 H46 L52 23 L46 30 H18 Z"
            fill="#72c58f"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path d="M22 50 H40" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path
            d="M20 12 H44 V24 Q44 38 32 40 Q20 38 20 24 Z"
            fill="#f7c948"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
          <path
            d="M20 16 H12 Q12 28 22 30 M44 16 H52 Q52 28 42 30"
            fill="none"
            stroke={INK}
            strokeWidth="3"
          />
          <path
            d="M32 40 V48 M22 54 H42 L40 48 H24 Z"
            fill="#b39bf0"
            stroke={INK}
            strokeWidth="3"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}
