import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  TextInput,
  PasswordInput,
  Button,
  Paper,
  Title,
  Text,
  Container,
  Stack,
  Alert,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle } from '@tabler/icons-react';
import { useLoginMutation } from '../../services/auth/authApi';
import { useAuth } from '../../services/auth/authSlice';
import { authActions } from '../../services/auth/authSlice';
import { useAppDispatch } from '../../app/hooks';

interface LoginFormValues {
  email: string;
  password: string;
}

export const LoginPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAuth();
  const [login, { isLoading, error }] = useLoginMutation();

  const form = useForm<LoginFormValues>({
    initialValues: {
      email: '',
      password: '',
    },
    validate: {
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Ungültige E-Mail-Adresse'),
      password: (value) => (value.length >= 6 ? null : 'Passwort muss mindestens 6 Zeichen haben'),
    },
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (values: LoginFormValues) => {
    try {
      const result = await login(values).unwrap();
      if (result.user) {
        dispatch(authActions.setUser(result.user));
        navigate('/dashboard');
      }
    } catch {
      // Error is handled by RTK Query
    }
  };

  return (
    <Container size="xs" py={100}>
      <Paper radius="md" p="xl" withBorder>
        <Title order={2} ta="center" mb="md">
          Willkommen zurück
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Melden Sie sich an, um Ihre Prüfungen zu verwalten
        </Text>

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Zugangsdaten.
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="E-Mail"
              placeholder="ihre@email.de"
              required
              {...form.getInputProps('email')}
            />
            <PasswordInput
              label="Passwort"
              placeholder="Ihr Passwort"
              required
              {...form.getInputProps('password')}
            />
            <Button type="submit" fullWidth loading={isLoading}>
              Anmelden
            </Button>
          </Stack>
        </form>

        <Text ta="center" mt="md" size="sm">
          Noch kein Konto?{' '}
          <Text component={Link} to="/register" c="blue" inherit>
            Registrieren
          </Text>
        </Text>
      </Paper>
    </Container>
  );
};
