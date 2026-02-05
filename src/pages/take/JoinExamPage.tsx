import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Button,
  Stack,
  Alert,
  Skeleton,
  Group,
  Badge,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { IconAlertCircle, IconClock } from '@tabler/icons-react';
import { useGetExamForStudentQuery, useJoinExamMutation } from '../../services/sessions/sessionsApi';

interface JoinFormValues {
  name: string;
  email: string;
}

export const JoinExamPage = () => {
  const { examId } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const { data: exam, isLoading, error: loadError } = useGetExamForStudentQuery(examId || '', {
    skip: !examId,
  });

  const [joinExam, { isLoading: joining }] = useJoinExamMutation();

  const form = useForm<JoinFormValues>({
    initialValues: {
      name: '',
      email: '',
    },
    validate: {
      name: (value) => (value.length >= 2 ? null : 'Bitte geben Sie Ihren Namen ein'),
      email: (value) => (/^\S+@\S+$/.test(value) ? null : 'Bitte geben Sie eine gültige E-Mail-Adresse ein'),
    },
  });

  const handleSubmit = async (values: JoinFormValues) => {
    if (!examId) return;
    setError(null);

    try {
      const session = await joinExam({
        exam_id: examId,
        student_name: values.name,
        student_email: values.email,
      }).unwrap();

      // Store session in localStorage for persistence
      localStorage.setItem(`exam_session_${examId}`, JSON.stringify({
        sessionId: session.id,
        studentName: values.name,
        studentEmail: values.email,
      }));

      navigate(`/take/${examId}/exam?session=${session.id}`);
    } catch (err: unknown) {
      setError('Die Anmeldung ist fehlgeschlagen. Bitte versuchen Sie es erneut.');
    }
  };

  if (isLoading) {
    return (
      <Container size="sm" py={100}>
        <Skeleton height={300} radius="md" />
      </Container>
    );
  }

  if (loadError || !exam) {
    return (
      <Container size="sm" py={100}>
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Prüfung nicht verfügbar">
          Diese Prüfung ist nicht verfügbar oder wurde noch nicht aktiviert.
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="sm" py={100}>
      <Paper radius="md" p="xl" withBorder>
        <Stack gap="lg">
          <div>
            <Title order={2} ta="center">
              {exam.title}
            </Title>
            {exam.description && (
              <Text c="dimmed" ta="center" mt="xs">
                {exam.description}
              </Text>
            )}
          </div>

          <Group justify="center" gap="md">
            <Badge size="lg" variant="light">
              {exam.questions.length} Aufgaben
            </Badge>
            {exam.time_limit_minutes && (
              <Badge size="lg" variant="light" leftSection={<IconClock size={14} />}>
                {exam.time_limit_minutes} Minuten
              </Badge>
            )}
          </Group>

          <Paper p="md" bg="blue.0" radius="md">
            <Text size="sm" ta="center">
              Geben Sie Ihren Namen und Ihre E-Mail-Adresse ein, um an der Prüfung teilzunehmen.
            </Text>
          </Paper>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <form onSubmit={form.onSubmit(handleSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Name"
                placeholder="Ihr vollständiger Name"
                required
                size="md"
                {...form.getInputProps('name')}
              />
              <TextInput
                label="E-Mail"
                placeholder="ihre@email.de"
                required
                size="md"
                {...form.getInputProps('email')}
              />
              <Button type="submit" size="lg" fullWidth loading={joining}>
                Prüfung starten
              </Button>
            </Stack>
          </form>
        </Stack>
      </Paper>
    </Container>
  );
};
