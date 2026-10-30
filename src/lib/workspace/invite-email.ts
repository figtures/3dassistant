import type { WorkspaceRole } from "@/types/database";
import { WORKSPACE_ROLE_LABELS } from "@/lib/workspace/role-labels";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildWorkspaceInviteEmail(opts: {
  workspaceName: string;
  role: WorkspaceRole;
  acceptUrl: string;
  expiresAt: string;
}): { subject: string; html: string; text: string } {
  const roleLabel = WORKSPACE_ROLE_LABELS[opts.role];
  const subject = `${opts.workspaceName} çalışma alanına davet edildiniz`;

  const html = `
    <p>Merhaba,</p>
    <p><strong>${escapeHtml(opts.workspaceName)}</strong> çalışma alanına
    <strong>${escapeHtml(roleLabel)}</strong> rolüyle davet edildiniz.</p>
    <p><a href="${escapeHtml(opts.acceptUrl)}">Daveti kabul et</a></p>
    <p style="color:#666;font-size:13px">Bağlantı ${escapeHtml(
      new Date(opts.expiresAt).toLocaleDateString("tr-TR")
    )} tarihine kadar geçerlidir.</p>
  `.trim();

  const text = [
    `Merhaba,`,
    ``,
    `${opts.workspaceName} çalışma alanına ${roleLabel} rolüyle davet edildiniz.`,
    `Kabul: ${opts.acceptUrl}`,
    `Son geçerlilik: ${new Date(opts.expiresAt).toLocaleString("tr-TR")}`,
  ].join("\n");

  return { subject, html, text };
}
