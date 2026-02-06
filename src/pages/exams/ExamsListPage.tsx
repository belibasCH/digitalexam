import { useState } from 'react';
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
  IconPlayerPlay,
  IconPlayerStop,
  IconEye,
  IconAlertCircle,
  IconCopy,
} from '@tabler/icons-react';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetExamsQuery,
  useDeleteExamMutation,
  useActivateExamMutation,
  useCloseExamMutation,
  useDuplicateExamMutation,
} from '../../services/exams/examsApi';
import { Exam } from '../../types/database';
import { notifications } from '@mantine/notifications';
import { SendInvitationsModal } from '../../components/exams/SendInvitationsModal';

const getStatusLabel = (status: Exam['status']) => {
  switch (status) {
    case 'draft':
      return 'Entwurf';
    case 'active':
      return 'Aktiv';
    case 'closed':
      return 'Beendet';
    default:
      return status;
  }
};

const getStatusColor = (status: Exam['status']) => {
  switch (status) {
    case 'draft':
      return 'gray';
    case 'active':
      return 'green';
    case 'closed':
      return 'red';
    default:
      return 'gray';
  }
};

export const ExamsListPage = () => {
  const user = useAuth();
  const { data: exams, isLoading, error } = useGetExamsQuery(user?.id || '', {
    skip: !user?.id,
  });
  const [deleteExam] = useDeleteExamMutation();
  const [activateExam] = useActivateExamMutation();
  const [closeExam] = useCloseExamMutation();
  const [duplicateExam] = useDuplicateExamMutation();
  const [invitationExam, setInvitationExam] = useState<Exam | null>(null);

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Möchten Sie die Prüfung "${title}" wirklich löschen?`)) {
      return;
    }

    try {
      await deleteExam(id).unwrap();
      notifications.show({
        title: 'Prüfung gelöscht',
        message: 'Die Prüfung wurde erfolgreich gelöscht.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht gelöscht werden.',
        color: 'red',
      });
    }
  };

  const handleActivate = (exam: Exam) => {
    setInvitationExam(exam);
  };

  const doActivate = async () => {
    if (!invitationExam) return;
    try {
      await activateExam(invitationExam.id).unwrap();
      notifications.show({
        title: 'Prüfung aktiviert',
        message: 'Die Prüfung ist jetzt für Schüler zugänglich.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht aktiviert werden.',
        color: 'red',
      });
      throw new Error('Activation failed');
    }
  };

  const handleClose = async (id: string) => {
    if (!window.confirm('Möchten Sie die Prüfung wirklich beenden? Schüler können dann keine Antworten mehr abgeben.')) {
      return;
    }

    try {
      await closeExam(id).unwrap();
      notifications.show({
        title: 'Prüfung beendet',
        message: 'Die Prüfung wurde geschlossen.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht beendet werden.',
        color: 'red',
      });
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateExam(id).unwrap();
      notifications.show({
        title: 'Prüfung dupliziert',
        message: 'Eine Kopie der Prüfung wurde als Entwurf erstellt.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht dupliziert werden.',
        color: 'red',
      });
    }
  };

  const copyExamLink = (id: string) => {
    const link = `${window.location.origin}/take/${id}`;
    navigator.clipboard.writeText(link);
    notifications.show({
      title: 'Link kopiert',
      message: 'Der Prüfungslink wurde in die Zwischenablage kopiert.',
      color: 'green',
    });
  };

  return (
    <Container size="lg">
      <Stack gap="lg">
        <Group justify="space-between">
          <div>
            <Title order={2}>Prüfungen</Title>
            <Text c="dimmed" mt="xs">
              Erstellen und verwalten Sie Ihre Prüfungen
            </Text>
          </div>
          <Button component={Link} to="/exams/new" leftSection={<IconPlus size={16} />}>
            Neue Prüfung
          </Button>
        </Group>

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Fehler beim Laden der Prüfungen.
          </Alert>
        )}

        {isLoading ? (
          <Stack gap="md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} radius="md" />
            ))}
          </Stack>
        ) : exams?.length === 0 ? (
          <Paper p="xl" radius="md" withBorder ta="center">
            <Text c="dimmed" mb="md">
              Sie haben noch keine Prüfungen erstellt.
            </Text>
            <Button component={Link} to="/exams/new" leftSection={<IconPlus size={16} />}>
              Erste Prüfung erstellen
            </Button>
          </Paper>
        ) : (
          <Stack gap="md">
            {exams?.map((exam) => (
              <Paper key={exam.id} p="md" radius="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Group gap="sm" mb="xs">
                      <Text fw={500} truncate>
                        {exam.title}
                      </Text>
                      <Badge color={getStatusColor(exam.status)} size="sm">
                        {getStatusLabel(exam.status)}
                      </Badge>
                      {exam.time_limit_minutes && (
                        <Badge variant="outline" size="sm">
                          {exam.time_limit_minutes} Min.
                        </Badge>
                      )}
                    </Group>
                    {exam.description && (
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {exam.description}
                      </Text>
                    )}
                    <Text size="xs" c="dimmed" mt="xs">
                      Erstellt am {new Date(exam.created_at).toLocaleDateString('de-DE')}
                    </Text>
                  </div>
                  <Group gap="xs">
                    {exam.status === 'active' && (
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconCopy size={14} />}
                        onClick={() => copyExamLink(exam.id)}
                      >
                        Link kopieren
                      </Button>
                    )}
                    <Menu shadow="md" width={180}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          component={Link}
                          to={`/exams/${exam.id}`}
                          leftSection={<IconEye size={14} />}
                        >
                          Anzeigen
                        </Menu.Item>
                        {exam.status === 'draft' && (
                          <>
                            <Menu.Item
                              component={Link}
                              to={`/exams/${exam.id}/edit`}
                              leftSection={<IconEdit size={14} />}
                            >
                              Bearbeiten
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconPlayerPlay size={14} />}
                              onClick={() => handleActivate(exam)}
                            >
                              Aktivieren
                            </Menu.Item>
                          </>
                        )}
                        {exam.status === 'active' && (
                          <>
                            <Menu.Item
                              component={Link}
                              to={`/exams/${exam.id}/monitor`}
                              leftSection={<IconEye size={14} />}
                            >
                              Überwachen
                            </Menu.Item>
                            <Menu.Item
                              leftSection={<IconPlayerStop size={14} />}
                              color="orange"
                              onClick={() => handleClose(exam.id)}
                            >
                              Beenden
                            </Menu.Item>
                          </>
                        )}
                        {exam.status === 'closed' && (
                          <Menu.Item
                            component={Link}
                            to={`/exams/${exam.id}/evaluate`}
                            leftSection={<IconEye size={14} />}
                          >
                            Auswerten
                          </Menu.Item>
                        )}
                        <Menu.Item
                          leftSection={<IconCopy size={14} />}
                          onClick={() => handleDuplicate(exam.id)}
                        >
                          Duplizieren
                        </Menu.Item>
                        <Menu.Divider />
                        <Menu.Item
                          color="red"
                          leftSection={<IconTrash size={14} />}
                          onClick={() => handleDelete(exam.id, exam.title)}
                        >
                          Löschen
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Group>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>

      {invitationExam && (
        <SendInvitationsModal
          opened={!!invitationExam}
          onClose={() => setInvitationExam(null)}
          examId={invitationExam.id}
          examTitle={invitationExam.title}
          onActivate={doActivate}
        />
      )}
    </Container>
  );
};
