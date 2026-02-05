import { Link } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Button,
  Paper,
  Group,
  Stack,
  Badge,
  ActionIcon,
  Menu,
  Skeleton,
  Alert,
} from '@mantine/core';
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconAlertCircle,
} from '@tabler/icons-react';
import { useAuth } from '../../services/auth/authSlice';
import { useGetQuestionsQuery, useDeleteQuestionMutation } from '../../services/questions/questionsApi';
import { Question } from '../../types/database';
import { notifications } from '@mantine/notifications';

const getQuestionTypeLabel = (type: Question['type']) => {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'free_text':
      return 'Freitext';
    case 'file_upload':
      return 'Dateiupload';
    default:
      return type;
  }
};

const getQuestionTypeColor = (type: Question['type']) => {
  switch (type) {
    case 'multiple_choice':
      return 'blue';
    case 'free_text':
      return 'green';
    case 'file_upload':
      return 'orange';
    default:
      return 'gray';
  }
};

export const QuestionsListPage = () => {
  const user = useAuth();
  const { data: questions, isLoading, error } = useGetQuestionsQuery(user?.id || '', {
    skip: !user?.id,
  });
  const [deleteQuestion] = useDeleteQuestionMutation();

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Möchten Sie die Aufgabe "${title}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteQuestion(id).unwrap();
      notifications.show({
        title: 'Aufgabe gelöscht',
        message: 'Die Aufgabe wurde erfolgreich gelöscht.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Aufgabe konnte nicht gelöscht werden.',
        color: 'red',
      });
    }
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Aufgaben</Title>
            <Text c="dimmed" mt="xs">
              Erstellen und verwalten Sie Ihre Aufgaben
            </Text>
          </div>
          <Button component={Link} to="/questions/new" leftSection={<IconPlus size={16} />}>
            Neue Aufgabe
          </Button>
        </Group>

        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Fehler beim Laden der Aufgaben.
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} radius="md" />
            ))}
          </Stack>
        ) : questions?.length === 0 ? (
          <Paper p="xl" radius="md" withBorder ta="center">
            <Text c="dimmed" mb="md">
              Sie haben noch keine Aufgaben erstellt.
            </Text>
            <Button component={Link} to="/questions/new" leftSection={<IconPlus size={16} />}>
              Erste Aufgabe erstellen
            </Button>
          </Paper>
        ) : (
          <Stack gap="md">
            {questions?.map((question) => (
              <Paper key={question.id} p="md" radius="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="sm" mb="xs">
                      <Text fw={500} truncate>
                        {question.title}
                      </Text>
                      <Badge color={getQuestionTypeColor(question.type)} size="sm">
                        {getQuestionTypeLabel(question.type)}
                      </Badge>
                      <Badge variant="outline" size="sm">
                        {question.points} {question.points === 1 ? 'Punkt' : 'Punkte'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed" lineClamp={2}>
                      {question.type === 'multiple_choice'
                        ? (question.content as { question: string }).question
                        : (question.content as { question: string }).question}
                    </Text>
                  </div>
                  <Menu shadow="md" width={150}>
                    <Menu.Target>
                      <ActionIcon variant="subtle" color="gray">
                        <IconDotsVertical size={16} />
                      </ActionIcon>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        component={Link}
                        to={`/questions/${question.id}/edit`}
                        leftSection={<IconEdit size={14} />}
                      >
                        Bearbeiten
                      </Menu.Item>
                      <Menu.Item
                        color="red"
                        leftSection={<IconTrash size={14} />}
                        onClick={() => handleDelete(question.id, question.title)}
                      >
                        Löschen
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    </Container>
  );
};
