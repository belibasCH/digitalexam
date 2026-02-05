import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  SimpleGrid,
  Paper,
  Group,
  ThemeIcon,
  Stack,
  Button,
  Skeleton,
} from '@mantine/core';
import {
  IconFileText,
  IconClipboardList,
  IconUsers,
  IconPlus,
} from '@tabler/icons-react';
import { useAuth } from '../../services/auth/authSlice';
import { useGetQuestionsQuery } from '../../services/questions/questionsApi';
import { useGetExamsQuery } from '../../services/exams/examsApi';

export const DashboardPage = () => {
  const user = useAuth();
  const { data: questions, isLoading: questionsLoading } = useGetQuestionsQuery(user?.id || '', {
    skip: !user?.id,
  });
  const { data: exams, isLoading: examsLoading } = useGetExamsQuery(user?.id || '', {
    skip: !user?.id,
  });

  const activeExams = exams?.filter(e => e.status === 'active') || [];
  const draftExams = exams?.filter(e => e.status === 'draft') || [];

  const stats = [
    {
      title: 'Aufgaben',
      value: questionsLoading ? null : questions?.length || 0,
      icon: IconFileText,
      color: 'blue',
      link: '/questions',
    },
    {
      title: 'Prüfungen',
      value: examsLoading ? null : exams?.length || 0,
      icon: IconClipboardList,
      color: 'green',
      link: '/exams',
    },
    {
      title: 'Aktive Prüfungen',
      value: examsLoading ? null : activeExams.length,
      icon: IconUsers,
      color: 'orange',
      link: '/exams',
    },
  ];

  return (
    <Container size="xl">
      <Stack gap="xl">
        <div>
          <Title order={2}>Willkommen, {user?.name}!</Title>
          <Text c="dimmed" mt="xs">
            Verwalten Sie Ihre Aufgaben und Prüfungen
          </Text>
        </div>

        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          {stats.map((stat) => (
            <Paper
              key={stat.title}
              component={Link}
              to={stat.link}
              p="md"
              radius="md"
              withBorder
              style={{ textDecoration: 'none' }}
            >
              <Group>
                <ThemeIcon size="xl" radius="md" color={stat.color}>
                  <stat.icon size={24} />
                </ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                    {stat.title}
                  </Text>
                  {stat.value === null ? (
                    <Skeleton height={28} width={40} mt={4} />
                  ) : (
                    <Text size="xl" fw={700}>
                      {stat.value}
                    </Text>
                  )}
                </div>
              </Group>
            </Paper>
          ))}
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }}>
          <Paper p="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Schnellaktionen</Title>
            </Group>
            <Stack gap="sm">
              <Button
                component={Link}
                to="/questions/new"
                leftSection={<IconPlus size={16} />}
                variant="light"
                fullWidth
              >
                Neue Aufgabe erstellen
              </Button>
              <Button
                component={Link}
                to="/exams/new"
                leftSection={<IconPlus size={16} />}
                variant="light"
                fullWidth
              >
                Neue Prüfung erstellen
              </Button>
            </Stack>
          </Paper>

          <Paper p="lg" radius="md" withBorder>
            <Group justify="space-between" mb="md">
              <Title order={4}>Entwürfe</Title>
              <Button
                component={Link}
                to="/exams"
                variant="subtle"
                size="xs"
              >
                Alle anzeigen
              </Button>
            </Group>
            {examsLoading ? (
              <Stack gap="sm">
                <Skeleton height={40} />
                <Skeleton height={40} />
              </Stack>
            ) : draftExams.length === 0 ? (
              <Text c="dimmed" size="sm">
                Keine Entwürfe vorhanden
              </Text>
            ) : (
              <Stack gap="sm">
                {draftExams.slice(0, 3).map((exam) => (
                  <Paper
                    key={exam.id}
                    component={Link}
                    to={`/exams/${exam.id}`}
                    p="sm"
                    bg="gray.0"
                    style={{ textDecoration: 'none' }}
                  >
                    <Text size="sm" fw={500}>
                      {exam.title}
                    </Text>
                    <Text size="xs" c="dimmed">
                      Erstellt am {new Date(exam.created_at).toLocaleDateString('de-DE')}
                    </Text>
                  </Paper>
                ))}
              </Stack>
            )}
          </Paper>
        </SimpleGrid>
      </Stack>
    </Container>
  );
};
