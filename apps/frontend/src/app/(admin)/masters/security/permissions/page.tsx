import { redirect } from 'next/navigation';

export default function LegacyPermissionsRedirect() {
  redirect('/masters/roles');
}
