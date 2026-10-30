"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  FormField,
  Input,
} from "@/components/ds";
import { HelpTitleRow } from "@/components/v2/help/contextual-help";
import { SettingsFormFooter } from "@/features/settings/settings-form-footer";

type ProfilePayload = {
  fullName: string;
  email: string;
};

export function ProfileSettingsScreen() {
  const [initial, setInitial] = useState<ProfilePayload | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/settings/profile");
    const data = (await res.json().catch(() => ({}))) as ProfilePayload & {
      error?: string;
    };
    if (!res.ok) {
      toast.error("Profil yüklenemedi", { description: data.error });
      setLoading(false);
      return;
    }
    setInitial({ fullName: data.fullName ?? "", email: data.email ?? "" });
    setFullName(data.fullName ?? "");
    setEmail(data.email ?? "");
    setNewEmail(data.email ?? "");
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const profileDirty =
    initial !== null &&
    fullName.trim() !== (initial.fullName ?? "").trim();

  const emailDirty =
    initial !== null && newEmail.trim() !== (initial.email ?? "").trim();

  const passwordDirty = password.length > 0 || passwordConfirm.length > 0;

  useEffect(() => {
    if (!profileDirty && !emailDirty && !passwordDirty) return;
    function onBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [profileDirty, emailDirty, passwordDirty]);

  async function saveProfile() {
    setSavingProfile(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName: fullName.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingProfile(false);
    if (!res.ok) {
      toast.error("Profil kaydedilemedi", { description: data.error });
      return;
    }
    toast.success("Profil güncellendi");
    await load();
  }

  async function saveEmail() {
    setSavingEmail(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: newEmail.trim() }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingEmail(false);
    if (!res.ok) {
      toast.error("E-posta güncellenemedi", { description: data.error });
      return;
    }
    toast.success("Doğrulama e-postası gönderildi", {
      description: "Yeni adresinizi onaylayana kadar giriş e-postanız değişmez.",
    });
    setPassword("");
    setPasswordConfirm("");
    await load();
  }

  async function savePassword() {
    if (password.length < 8) {
      toast.error("Şifre en az 8 karakter olmalı");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Şifreler eşleşmiyor");
      return;
    }
    setSavingPassword(true);
    const res = await fetch("/api/settings/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setSavingPassword(false);
    if (!res.ok) {
      toast.error("Şifre güncellenemedi", { description: data.error });
      return;
    }
    toast.success("Şifre güncellendi");
    setPassword("");
    setPasswordConfirm("");
  }

  if (loading) {
    return (
      <div className="space-y-4 pb-8">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-8">
      <header className="space-y-1">
        <HelpTitleRow>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground">
            Profil
          </h1>
        </HelpTitleRow>
        <p className="max-w-xl text-sm text-muted-foreground">
          Kişisel bilgileriniz ve hesap güvenliği.
        </p>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Kişisel bilgiler</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <span
              className="flex size-14 items-center justify-center rounded-xl bg-primary text-lg font-semibold text-primary-foreground"
              aria-hidden
            >
              {(fullName || email).charAt(0).toUpperCase()}
            </span>
            <p className="text-sm text-muted-foreground">
              Profil fotoğrafı yakında eklenecek.
            </p>
          </div>
          <FormField label="Ad soyad">
            {(field) => (
              <Input
                {...field}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
              />
            )}
          </FormField>
          <SettingsFormFooter
            dirty={profileDirty}
            saving={savingProfile}
            onSave={() => void saveProfile()}
            onDiscard={() => setFullName(initial?.fullName ?? "")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">E-posta</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Mevcut adres: <span className="text-foreground">{email}</span>
          </p>
          <FormField label="Yeni e-posta">
            {(field) => (
              <Input
                {...field}
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                autoComplete="email"
              />
            )}
          </FormField>
          {emailDirty ? (
            <Button type="button" loading={savingEmail} onClick={() => void saveEmail()}>
              E-postayı güncelle
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-base font-semibold text-foreground">Şifre</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField label="Yeni şifre">
            {(field) => (
              <Input
                {...field}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </FormField>
          <FormField label="Yeni şifre (tekrar)">
            {(field) => (
              <Input
                {...field}
                type="password"
                value={passwordConfirm}
                onChange={(e) => setPasswordConfirm(e.target.value)}
                autoComplete="new-password"
              />
            )}
          </FormField>
          {passwordDirty ? (
            <Button type="button" loading={savingPassword} onClick={() => void savePassword()}>
              Şifreyi güncelle
            </Button>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
