import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Box } from 'lucide-react';

export const metadata: Metadata = { title: 'Privacy | SFS Warehouse' };

export default function PrivacyPage() {
  return <main className="privacy-page">
    <header className="privacy-header">
      <Link href="/login" className="privacy-brand"><Box size={23}/> SFS WAREHOUSE</Link>
      <Link href="/login" className="text-button"><ArrowLeft size={15}/> Back to sign in</Link>
    </header>
    <article className="privacy-card">
      <p className="eyebrow">YOUR ACCOUNT AND WORKPLACE DATA</p>
      <h1>Privacy notice</h1>
      <p className="privacy-date">Updated October 13, 2026 · Development pilot</p>
      <p>SFS Warehouse uses account information to sign you in, connect you to your facility, and show the work your facility owner has assigned to you. This notice describes the current pilot.</p>

      <section><h2>Account information and Google sign-in</h2>
        <p>Email accounts use an email address and password. Supabase provides account authentication, verification and recovery. Passwords are sent to Supabase through the app’s secure sign-in service and are not saved in the warehouse database.</p>
        <p>If you choose Google sign-in when it is available, Google shares your account identifier, email address and basic profile information, which may include your name and profile picture, with Supabase. SFS Warehouse uses your verified email and account identifier to match your facility membership. The login requests only basic identity permissions; it does not request access to your Gmail messages, contacts, calendar or Drive files.</p>
      </section>

      <section><h2>Workplace records and access</h2>
        <p>Your facility owner and supervisors maintain employee records, assignments and operational records. The app records assignment acknowledgments and an audit history of warehouse changes. Owners manage membership and roles. Employees can retrieve their own published assignment; creating an account alone does not grant warehouse access.</p>
      </section>

      <section><h2>Cookies, notifications and technical information</h2>
        <p>Sign-in cookies keep your session active. The app also uses limited technical information to secure the service, including hashed email and network identifiers for sign-in rate limits. Hosting and authentication providers may process connection information and service logs.</p>
        <p>Phone alerts are optional. If you enable them, the app stores a device push subscription and delivery records, and sends generic assignment-change alerts through your browser’s push service. You can disable alerts in your device settings. Private warehouse records are not cached for offline access.</p>
      </section>

      <section><h2>Services that process information</h2>
        <p>Supabase processes authentication data. OpenAI Sites and Cloudflare host the app and warehouse records. Google processes Google sign-in and serves the fonts used on these pages. Browser push providers deliver alerts when you opt in. These services process the information needed to provide their functions under their own terms and privacy notices.</p>
        <p>The pilot has no advertising or data-sale feature and does not use Google account information for advertising.</p>
      </section>

      <section><h2>Retention, corrections and deletion requests</h2>
        <p>The pilot has no automatic account-deletion or retention schedule. Account, membership and operational records remain until they are reviewed and removed where supported. Operational audit records are append-only; corrections are recorded as new events. Revoking facility access does not erase existing records.</p>
        <p>Ask your facility owner to correct workplace information or remove access. For account information or a deletion request, contact <a href="mailto:sfshkhalsa@gmail.com">sfshkhalsa@gmail.com</a>. Requests require identity verification and review of the records involved. You can also remove SFS Warehouse’s Google access in your Google Account settings; this does not itself delete an SFS account or warehouse history.</p>
      </section>

      <section><h2>Contact and changes</h2>
        <p>For questions about this notice, contact <a href="mailto:sfshkhalsa@gmail.com">sfshkhalsa@gmail.com</a>. Check the date above for changes to this notice as the pilot develops.</p>
      </section>
    </article>
  </main>;
}
