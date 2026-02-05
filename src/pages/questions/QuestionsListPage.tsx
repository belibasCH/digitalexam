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
  Select,
  TextInput,
  SegmentedControl,
  Tooltip,
} from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import {
  IconPlus,
  IconDotsVertical,
  IconEdit,
  IconTrash,
  IconAlertCircle,
  IconSearch,
  IconFilter,
  IconShare,
  IconCopy,
  IconUsers,
} from '@tabler/icons-react';
import { useAuth } from '../../services/auth/authSlice';
import { useGetQuestionsQuery, useDeleteQuestionMutation } from '../../services/questions/questionsApi';
import { useGetSubjectsQuery } from '../../services/subjects/subjectsApi';
import { useGetMyGroupsQuery } from '../../services/groups/groupsApi';
import { useGetSharedQuestionsQuery, useCopySharedQuestionMutation } from '../../services/groups/sharingApi';
import { Question, QuestionType, BLOOM_LEVELS, QuestionWithSharing } from '../../types/database';
import { notifications } from '@mantine/notifications';
import { ShareQuestionModal } from '../../components/questions/ShareQuestionModal';

const getQuestionTypeLabel = (type: QuestionType) => {
  switch (type) {
    case 'multiple_choice':
      return 'Multiple Choice';
    case 'free_text':
      return 'Freitext';
    case 'file_upload':
      return 'Dateiupload';
    case 'kprim':
      return 'K-Prim';
    case 'cloze':
      return 'Lückentext';
    case 'matching':
      return 'Zuordnung';
    case 'essay':
      return 'Aufsatz';
    default:
      return type;
  }
};

const getQuestionTypeColor = (type: QuestionType) => {
  switch (type) {
    case 'multiple_choice':
      return 'blue';
    case 'free_text':
      return 'green';
    case 'file_upload':
      return 'orange';
    case 'kprim':
      return 'violet';
    case 'cloze':
      return 'cyan';
    case 'matching':
      return 'pink';
    case 'essay':
      return 'teal';
    default:
      return 'gray';
  }
};

type ViewMode = 'mine' | 'shared' | 'all';

export const QuestionsListPage = () => {
  const user = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('mine');
  const [groupFilter, setGroupFilter] = useState<string | null>(null);
  const [shareModalOpened, { open: openShareModal, close: closeShareModal }] = useDisclosure(false);
  const [selectedQuestionForShare, setSelectedQuestionForShare] = useState<{ id: string; title: string } | null>(null);

  const { data: questions, isLoading, error } = useGetQuestionsQuery(user?.id || '', {
    skip: !user?.id,
  });
  const { data: subjects } = useGetSubjectsQuery(user?.id || '', {
    skip: !user?.id,
  });
  const { data: groups } = useGetMyGroupsQuery();
  const { data: sharedQuestions, isLoading: loadingShared } = useGetSharedQuestionsQuery(undefined, {
    skip: viewMode === 'mine',
  });
  const [deleteQuestion] = useDeleteQuestionMutation();
  const [copyQuestion, { isLoading: copying }] = useCopySharedQuestionMutation();

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

  const handleOpenShare = (questionId: string, questionTitle: string) => {
    setSelectedQuestionForShare({ id: questionId, title: questionTitle });
    openShareModal();
  };

  const handleCloseShare = () => {
    setSelectedQuestionForShare(null);
    closeShareModal();
  };

  const handleCopyQuestion = async (questionId: string) => {
    try {
      await copyQuestion(questionId).unwrap();
      notifications.show({
        title: 'Aufgabe kopiert',
        message: 'Die Aufgabe wurde in Ihre Sammlung kopiert.',
        color: 'green',
      });
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Aufgabe konnte nicht kopiert werden.',
        color: 'red',
      });
    }
  };

  const subjectOptions = subjects?.map(s => ({ value: s.id, label: s.name })) || [];
  const groupOptions = groups?.map(g => ({ value: g.id, label: g.name })) || [];
  const typeOptions: { value: QuestionType; label: string }[] = [
    { value: 'multiple_choice', label: 'Multiple Choice' },
    { value: 'kprim', label: 'K-Prim' },
    { value: 'free_text', label: 'Freitext' },
    { value: 'essay', label: 'Aufsatz' },
    { value: 'cloze', label: 'Lückentext' },
    { value: 'matching', label: 'Zuordnung' },
    { value: 'file_upload', label: 'Dateiupload' },
  ];

  const getSubjectName = (subjectId: string | undefined) => {
    if (!subjectId) return null;
    return subjects?.find(s => s.id === subjectId)?.name;
  };

  const getBloomLabel = (level: string | undefined) => {
    if (!level) return null;
    return BLOOM_LEVELS.find(b => b.value === level)?.label;
  };

  // Combine questions based on view mode
  const getQuestionsToDisplay = (): (Question | QuestionWithSharing)[] => {
    const myQuestions = questions || [];
    const shared = sharedQuestions || [];

    switch (viewMode) {
      case 'mine':
        return myQuestions;
      case 'shared':
        // Only show questions from others
        return shared.filter(q => q.teacher_id !== user?.id);
      case 'all':
        // Combine my questions and shared questions from others
        const sharedFromOthers = shared.filter(q => q.teacher_id !== user?.id);
        const myIds = new Set(myQuestions.map(q => q.id));
        const uniqueShared = sharedFromOthers.filter(q => !myIds.has(q.id));
        return [...myQuestions, ...uniqueShared];
      default:
        return myQuestions;
    }
  };

  // Filter questions
  const filteredQuestions = getQuestionsToDisplay().filter(q => {
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = q.title.toLowerCase().includes(query);
      const matchesQuestion = (q.content as { question: string }).question?.toLowerCase().includes(query);
      if (!matchesTitle && !matchesQuestion) return false;
    }
    // Subject filter (only for own questions)
    if (subjectFilter && q.subject_id !== subjectFilter) return false;
    // Type filter
    if (typeFilter && q.type !== typeFilter) return false;
    return true;
  }) || [];

  const isOwnQuestion = (question: Question | QuestionWithSharing): boolean => {
    return question.teacher_id === user?.id;
  };

  const getSharedByName = (question: Question | QuestionWithSharing): string | null => {
    const withSharing = question as QuestionWithSharing;
    return withSharing.shared_by_profile?.name || null;
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

        {/* View Mode Toggle */}
        {groups && groups.length > 0 && (
          <SegmentedControl
            value={viewMode}
            onChange={(value) => setViewMode(value as ViewMode)}
            data={[
              { value: 'mine', label: 'Meine Aufgaben' },
              { value: 'shared', label: 'Geteilte Aufgaben' },
              { value: 'all', label: 'Alle' },
            ]}
          />
        )}

        {/* Filters */}
        <Paper p="md" radius="md" withBorder>
          <Group>
            <TextInput
              placeholder="Aufgaben suchen..."
              leftSection={<IconSearch size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            {viewMode === 'mine' && (
              <Select
                placeholder="Fach"
                data={subjectOptions}
                value={subjectFilter}
                onChange={setSubjectFilter}
                clearable
                leftSection={<IconFilter size={16} />}
                w={200}
              />
            )}
            <Select
              placeholder="Aufgabentyp"
              data={typeOptions}
              value={typeFilter}
              onChange={setTypeFilter}
              clearable
              w={180}
            />
          </Group>
        </Paper>

        {!!error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Fehler beim Laden der Aufgaben.
          </Alert>
        )}

        {isLoading || loadingShared ? (
          <Stack gap="md">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} height={100} radius="md" />
            ))}
          </Stack>
        ) : filteredQuestions.length === 0 ? (
          <Paper p="xl" radius="md" withBorder ta="center">
            <Text c="dimmed" mb="md">
              {viewMode === 'shared'
                ? 'Keine geteilten Aufgaben gefunden.'
                : questions?.length === 0
                  ? 'Sie haben noch keine Aufgaben erstellt.'
                  : 'Keine Aufgaben gefunden.'}
            </Text>
            {viewMode === 'mine' && questions?.length === 0 && (
              <Button component={Link} to="/questions/new" leftSection={<IconPlus size={16} />}>
                Erste Aufgabe erstellen
              </Button>
            )}
            {viewMode === 'shared' && (
              <Button component={Link} to="/groups" variant="light">
                Gruppen verwalten
              </Button>
            )}
          </Paper>
        ) : (
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              {filteredQuestions.length} Aufgabe{filteredQuestions.length !== 1 ? 'n' : ''} gefunden
            </Text>
            {filteredQuestions.map((question) => {
              const isMine = isOwnQuestion(question);
              const sharedByName = getSharedByName(question);

              return (
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
                        {!isMine && sharedByName && (
                          <Tooltip label={`Geteilt von ${sharedByName}`}>
                            <Badge
                              size="sm"
                              variant="light"
                              color="blue"
                              leftSection={<IconUsers size={10} />}
                            >
                              {sharedByName}
                            </Badge>
                          </Tooltip>
                        )}
                      </Group>
                      <Text size="sm" c="dimmed" lineClamp={2}>
                        {(question.content as { question: string }).question}
                      </Text>
                      <Group gap="xs" mt="xs">
                        {isMine && getSubjectName(question.subject_id) && (
                          <Badge size="xs" variant="light" color="gray">
                            {getSubjectName(question.subject_id)}
                          </Badge>
                        )}
                        {getBloomLabel(question.bloom_level) && (
                          <Badge size="xs" variant="dot">
                            {getBloomLabel(question.bloom_level)}
                          </Badge>
                        )}
                      </Group>
                    </div>
                    <Menu shadow="md" width={180}>
                      <Menu.Target>
                        <ActionIcon variant="subtle" color="gray">
                          <IconDotsVertical size={16} />
                        </ActionIcon>
                      </Menu.Target>
                      <Menu.Dropdown>
                        {isMine ? (
                          <>
                            <Menu.Item
                              component={Link}
                              to={`/questions/${question.id}/edit`}
                              leftSection={<IconEdit size={14} />}
                            >
                              Bearbeiten
                            </Menu.Item>
                            {groups && groups.length > 0 && (
                              <Menu.Item
                                leftSection={<IconShare size={14} />}
                                onClick={() => handleOpenShare(question.id, question.title)}
                              >
                                Teilen
                              </Menu.Item>
                            )}
                            <Menu.Divider />
                            <Menu.Item
                              color="red"
                              leftSection={<IconTrash size={14} />}
                              onClick={() => handleDelete(question.id, question.title)}
                            >
                              Löschen
                            </Menu.Item>
                          </>
                        ) : (
                          <>
                            <Menu.Item
                              leftSection={<IconCopy size={14} />}
                              onClick={() => handleCopyQuestion(question.id)}
                            >
                              In meine Sammlung kopieren
                            </Menu.Item>
                          </>
                        )}
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>

      {/* Share Question Modal */}
      {selectedQuestionForShare && (
        <ShareQuestionModal
          opened={shareModalOpened}
          onClose={handleCloseShare}
          questionId={selectedQuestionForShare.id}
          questionTitle={selectedQuestionForShare.title}
        />
      )}
    </Container>
  );
};
