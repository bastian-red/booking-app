import { Nav } from '../../components/nav';
import { AuthForm } from '../../components/auth-form';
import { loginAction } from '../auth-actions';

export default function LoginPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <AuthForm mode="login" action={loginAction} />
      </main>
    </>
  );
}
