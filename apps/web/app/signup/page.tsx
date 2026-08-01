import { Nav } from '../../components/nav';
import { AuthForm } from '../../components/auth-form';
import { signupAction } from '../auth-actions';

export default function SignupPage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Nav />
      <main id="main">
        <AuthForm mode="signup" action={signupAction} />
      </main>
    </>
  );
}
