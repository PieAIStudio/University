import { useRef, useState, useSyncExternalStore } from "react";
import { GameButton, GameField, GameInput, GameModal } from "@pieai/swimmer-ui-kit";
import { AuthForm } from "@pieaistudio/swimmer-auth-kit/react";
import type { AuthPort, AuthResult } from "@pieaistudio/swimmer-auth-kit";
import type { IdentityPort } from "@pieai/university-core";
import { useI18n } from "../../i18n/index.js";

type ClosureReceipt = {
  readonly status: "review-required";
  readonly operationId: string;
};

/** Product deletion scope; authentication itself stays in the shared Kit. */
export function AccountClosurePanel({
  identity,
  auth,
  confirmationPhrase,
  requestClosure,
}: {
  readonly identity: IdentityPort;
  readonly auth: AuthPort | null;
  readonly confirmationPhrase: string;
  readonly requestClosure:
    | ((
        expectedUserId: string,
        operationId: string,
        confirmation: string,
      ) => Promise<ClosureReceipt>)
    | null;
}) {
  const interfaceTranslator = useI18n();
  const { locale } = useI18n();
  const identityState = useSyncExternalStore(identity.subscribe, identity.status, identity.status);
  const [owner, setOwner] = useState<string | null>(null);
  const [stage, setStage] = useState<"verify" | "confirm" | "review">("verify");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const operation = useRef<string | null>(null);
  const latest = () => {
    const value = identity.status();
    return value.kind === "signed_in" ? value.user.id : null;
  };
  const sameAccount = owner !== null && latest() === owner;

  async function verified(result: AuthResult) {
    if (result.status !== "authenticated" || !owner || !auth) return;
    const user = await auth.getCurrentUser();
    if (user?.id !== owner || user.is_anonymous || latest() !== owner) {
      setError(interfaceTranslator.t("account.closure.changed"));
      return;
    }
    setError(null);
    setStage("confirm");
  }

  async function submit() {
    if (
      sending.current ||
      !owner ||
      !requestClosure ||
      !sameAccount ||
      confirmation !== confirmationPhrase
    )
      return;
    sending.current = true;
    setBusy(true);
    setError(null);
    const expected = owner;
    try {
      operation.current ??= crypto.randomUUID();
      const result = await requestClosure(expected, operation.current, confirmation);
      if (latest() === expected) {
        setReceipt(result.operationId);
        setStage("review");
      }
    } catch (reason) {
      const code = reason && typeof reason === "object" && "code" in reason ? reason.code : null;
      if (latest() !== expected) setError(interfaceTranslator.t("account.closure.changed"));
      else if (code === "reauthentication-required") {
        setStage("verify");
        setError(interfaceTranslator.t("account.closure.reauthenticate"));
      } else setError(interfaceTranslator.t("account.closure.failed"));
    } finally {
      sending.current = false;
      setBusy(false);
      setConfirmation("");
    }
  }

  if (identityState.kind !== "signed_in" && !owner) return null;
  return (
    <>
      <details className="product-details">
        <summary>{interfaceTranslator.t("account.closure.section")}</summary>
        <GameButton
          type="button"
          variant="ghost"
          onClick={() => {
            const userId = latest();
            if (!userId) return;
            setOwner(userId);
            setStage("verify");
            setConfirmation("");
            setError(null);
            operation.current = null;
          }}
        >
          {interfaceTranslator.t("account.closure.open")}
        </GameButton>
      </details>
      {owner ? (
        <GameModal
          open
          title={interfaceTranslator.t("account.closure.title")}
          closeLabel={interfaceTranslator.t("account.closure.close")}
          closeOnBackdrop={!busy}
          onClose={() => {
            if (!busy) setOwner(null);
          }}
        >
          <p>{interfaceTranslator.t("account.closure.scope")}</p>
          {error ? <p role="alert">{error}</p> : null}
          {!sameAccount ? (
            <p role="alert">{interfaceTranslator.t("account.closure.changed")}</p>
          ) : !auth || !requestClosure ? (
            <p role="status">{interfaceTranslator.t("account.closure.unavailable")}</p>
          ) : stage === "review" ? (
            <div role="status">
              <p>{interfaceTranslator.t("account.closure.review")}</p>
              <p>
                {interfaceTranslator.t("account.closure.request")}: <code>{receipt}</code>
              </p>
            </div>
          ) : stage === "verify" ? (
            <>
              <p>{interfaceTranslator.t("account.closure.verify")}</p>
              <AuthForm
                key={owner}
                port={auth}
                locale={locale.startsWith("zh") ? "zh" : "en"}
                allowRegistration={false}
                allowEmailCode
                onResult={verified}
              />
            </>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <p>
                <code>{confirmationPhrase}</code>
              </p>
              <GameField label={interfaceTranslator.t("account.closure.confirm")}>
                <GameInput
                  aria-label={interfaceTranslator.t("account.closure.confirm")}
                  autoComplete="off"
                  value={confirmation}
                  disabled={busy}
                  onChange={(event) => setConfirmation(event.currentTarget.value)}
                />
              </GameField>
              <GameButton
                type="submit"
                variant="primary"
                surface="liquid"
                fullWidth
                disabled={busy || confirmation !== confirmationPhrase}
              >
                {interfaceTranslator.t(busy ? "account.closure.working" : "account.closure.submit")}
              </GameButton>
            </form>
          )}
          <GameButton type="button" variant="ghost" disabled={busy} onClick={() => setOwner(null)}>
            {interfaceTranslator.t(
              stage === "review" ? "account.closure.close" : "account.closure.cancel",
            )}
          </GameButton>
        </GameModal>
      ) : null}
    </>
  );
}
