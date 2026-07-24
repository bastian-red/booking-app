import { Nav } from '../../components/nav';
import { AuthForm } from '../../components/auth-form';
import { signupAction } from '../auth-actions';

export default function SignupPage() {
  return (
    <>
      <Nav />
      <AuthForm mode="signup" action={signupAction} />
    </>
  );
}
