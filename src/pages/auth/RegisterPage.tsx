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
import { IconAlertCircle, IconCheck } from '@tabler/icons-react';
import { useRegisterMutation } from '../../services/auth/authApi';
import { useAuth, authActions } from '../../services/auth/authSlice';
import { useAppDispatch } from '../../app/hooks';
import { notifications } from '@mantine/notifications';

interface RegisterFormValues {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export const RegisterPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAuth();
  const [register, { isLoading, error }] = useRegisterMutation();

  const form = useForm<RegisterFormValues>({
    initialValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
    },
    validate: {
      name: (value) => (value.length >= 2 ? null : 'Name muss mindestens 2 Zeichen haben'),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Ungültige E-Mail-Adresse'),
      password: (value) => (value.length >= 6 ? null : 'Passwort muss mindestens 6 Zeichen haben'),
      confirmPassword: (value, values) =>
        value === values.password ? null : 'Passwörter stimmen nicht überein',
    },
  });

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleSubmit = async (values: RegisterFormValues) => {
    try {
      const result = await register({
        name: values.name,
        email: values.email,
        password: values.password,
      }).unwrap();

      if (result.user) {
        dispatch(authActions.setUser(result.user));
        notifications.show({
          title: 'Registrierung erfolgreich',
          message: 'Willkommen! Ihr Konto wurde erstellt.',
          color: 'green',
          icon: <IconCheck size={16} />,
        });
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
          Konto erstellen
        </Title>
        <Text c="dimmed" size="sm" ta="center" mb="xl">
          Registrieren Sie sich als Lehrer
        </Text>

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md">
            Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.
          </Alert>
        )}

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack>
            <TextInput
              label="Name"
              placeholder="Ihr Name"
              required
              {...form.getInputProps('name')}
            />
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
            <PasswordInput
              label="Passwort bestätigen"
              placeholder="Passwort wiederholen"
              required
              {...form.getInputProps('confirmPassword')}
            />
            <Button type="submit" fullWidth loading={isLoading}>
              Registrieren
            </Button>
          </Stack>
        </form>

        <Text ta="center" mt="md" size="sm">
          Bereits registriert?{' '}
          <Text component={Link} to="/login" c="blue" inherit>
            Anmelden
          </Text>
        </Text>
      </Paper>
    </Container>
  );
};
