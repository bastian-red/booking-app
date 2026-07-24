import { Nav } from '../../components/nav';
import { AuthForm } from '../../components/auth-form';
import { loginAction } from '../auth-actions';

export default function LoginPage() {
  return (
    <>
      <Nav />
      <AuthForm mode="login" action={loginAction} />
    </>
  );
}
