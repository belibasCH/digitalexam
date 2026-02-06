import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Title,
  Text,
  Paper,
  TextInput,
  Textarea,
  NumberInput,
  Button,
  Group,
  Stack,
  Checkbox,
  Skeleton,
  Badge,
  ActionIcon,
  Collapse,
  Divider,
  Modal,
} from '@mantine/core';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { useForm } from '@mantine/form';
import { useDisclosure } from '@mantine/hooks';
import {
  IconGripVertical,
  IconTrash,
  IconPlus,
  IconChevronDown,
  IconChevronRight,
  IconEdit,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { useAuth } from '../../services/auth/authSlice';
import {
  useGetExamWithQuestionsQuery,
  useCreateExamMutation,
  useUpdateExamMutation,
  useSaveSectionsWithQuestionsMutation,
} from '../../services/exams/examsApi';
import { useGetQuestionsQuery } from '../../services/questions/questionsApi';
import { Question } from '../../types/database';

interface FormValues {
  title: string;
  description: string;
  time_limit_minutes: number | undefined;
  has_time_limit: boolean;
  lock_on_tab_leave: boolean;
}

interface SectionData {
  id: string;
  title: string;
  description: string;
  question_ids: string[];
  isExpanded: boolean;
}

const generateTempId = () => `temp_${Math.random().toString(36).substring(2, 11)}`;

export const ExamEditorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const user = useAuth();
  const isEditing = !!id;

  const [sections, setSections] = useState<SectionData[]>([]);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionModalOpened, { open: openSectionModal, close: closeSectionModal }] = useDisclosure(false);
  const [sectionForm, setSectionForm] = useState({ title: '', description: '' });

  const { data: existingExam, isLoading: loadingExam } = useGetExamWithQuestionsQuery(id || '', {
    skip: !id,
  });

  const { data: allQuestions, isLoading: loadingQuestions } = useGetQuestionsQuery(user?.id || '', {
    skip: !user?.id,
  });

  const [createExam, { isLoading: creating }] = useCreateExamMutation();
  const [updateExam, { isLoading: updating }] = useUpdateExamMutation();
  const [saveSectionsWithQuestions, { isLoading: savingSections }] = useSaveSectionsWithQuestionsMutation();

  const form = useForm<FormValues>({
    initialValues: {
      title: '',
      description: '',
      time_limit_minutes: undefined,
      has_time_limit: false,
      lock_on_tab_leave: false,
    },
    validate: {
      title: (value) => (value.length > 0 ? null : 'Titel ist erforderlich'),
    },
  });

  useEffect(() => {
    if (existingExam) {
      form.setValues({
        title: existingExam.title,
        description: existingExam.description || '',
        time_limit_minutes: existingExam.time_limit_minutes || undefined,
        has_time_limit: !!existingExam.time_limit_minutes,
        lock_on_tab_leave: !!existingExam.lock_on_tab_leave,
      });

      // Load sections
      if (existingExam.sections && existingExam.sections.length > 0) {
        setSections(
          existingExam.sections.map((s) => ({
            id: s.id,
            title: s.title,
            description: s.description || '',
            question_ids: s.questions.map((q) => q.id),
            isExpanded: true,
          }))
        );
      } else if (existingExam.questions.length > 0) {
        // Backward compatibility: create a default section with unsectioned questions
        setSections([
          {
            id: generateTempId(),
            title: 'Sektion 1',
            description: '',
            question_ids: existingExam.questions.map((q) => q.id),
            isExpanded: true,
          },
        ]);
      }
    }
  }, [existingExam]);

  const handleSubmit = async (values: FormValues) => {
    if (!user?.id) return;

    if (sections.length === 0) {
      notifications.show({
        title: 'Fehler',
        message: 'Bitte fügen Sie mindestens eine Sektion hinzu.',
        color: 'red',
      });
      return;
    }

    try {
      let examId = id;

      if (isEditing && id) {
        await updateExam({
          id,
          data: {
            title: values.title,
            description: values.description || undefined,
            time_limit_minutes: values.has_time_limit ? values.time_limit_minutes : undefined,
            lock_on_tab_leave: values.lock_on_tab_leave,
          },
        }).unwrap();
      } else {
        const newExam = await createExam({
          teacher_id: user.id,
          title: values.title,
          description: values.description || undefined,
          time_limit_minutes: values.has_time_limit ? values.time_limit_minutes : undefined,
          lock_on_tab_leave: values.lock_on_tab_leave,
        }).unwrap();
        examId = newExam.id;
      }

      if (examId) {
        await saveSectionsWithQuestions({
          exam_id: examId,
          sections: sections.map((s, index) => ({
            id: s.id.startsWith('temp_') ? undefined : s.id,
            title: s.title,
            description: s.description || undefined,
            order_index: index,
            question_ids: s.question_ids,
          })),
        }).unwrap();
      }

      notifications.show({
        title: isEditing ? 'Prüfung aktualisiert' : 'Prüfung erstellt',
        message: isEditing ? 'Die Änderungen wurden gespeichert.' : 'Die neue Prüfung wurde erstellt.',
        color: 'green',
      });
      navigate('/exams');
    } catch {
      notifications.show({
        title: 'Fehler',
        message: 'Die Prüfung konnte nicht gespeichert werden.',
        color: 'red',
      });
    }
  };

  const addSection = () => {
    setEditingSectionId(null);
    setSectionForm({ title: '', description: '' });
    openSectionModal();
  };

  const editSection = (sectionId: string) => {
    const section = sections.find((s) => s.id === sectionId);
    if (section) {
      setEditingSectionId(sectionId);
      setSectionForm({ title: section.title, description: section.description });
      openSectionModal();
    }
  };

  const saveSection = () => {
    if (!sectionForm.title.trim()) {
      notifications.show({
        title: 'Fehler',
        message: 'Bitte geben Sie einen Titel ein.',
        color: 'red',
      });
      return;
    }

    if (editingSectionId) {
      setSections((prev) =>
        prev.map((s) =>
          s.id === editingSectionId
            ? { ...s, title: sectionForm.title, description: sectionForm.description }
            : s
        )
      );
    } else {
      setSections((prev) => [
        ...prev,
        {
          id: generateTempId(),
          title: sectionForm.title,
          description: sectionForm.description,
          question_ids: [],
          isExpanded: true,
        },
      ]);
    }

    closeSectionModal();
  };

  const deleteSection = (sectionId: string) => {
    if (!window.confirm('Möchten Sie diese Sektion wirklich löschen?')) return;
    setSections((prev) => prev.filter((s) => s.id !== sectionId));
  };

  const toggleSectionExpanded = (sectionId: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, isExpanded: !s.isExpanded } : s))
    );
  };

  const addQuestionToSection = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId ? { ...s, question_ids: [...s.question_ids, questionId] } : s
      )
    );
  };

  const removeQuestionFromSection = (sectionId: string, questionId: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, question_ids: s.question_ids.filter((id) => id !== questionId) }
          : s
      )
    );
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;

    const { source, destination, type } = result;

    if (type === 'SECTION') {
      const items = Array.from(sections);
      const [reorderedItem] = items.splice(source.index, 1);
      items.splice(destination.index, 0, reorderedItem);
      setSections(items);
      return;
    }

    // Question drag within/between sections
    const sourceSectionId = source.droppableId;
    const destSectionId = destination.droppableId;

    if (sourceSectionId === destSectionId) {
      // Reorder within same section
      setSections((prev) =>
        prev.map((s) => {
          if (s.id !== sourceSectionId) return s;
          const items = Array.from(s.question_ids);
          const [reorderedItem] = items.splice(source.index, 1);
          items.splice(destination.index, 0, reorderedItem);
          return { ...s, question_ids: items };
        })
      );
    } else {
      // Move between sections
      setSections((prev) => {
        const sourceSection = prev.find((s) => s.id === sourceSectionId);
        if (!sourceSection) return prev;

        const questionId = sourceSection.question_ids[source.index];

        return prev.map((s) => {
          if (s.id === sourceSectionId) {
            return {
              ...s,
              question_ids: s.question_ids.filter((_, i) => i !== source.index),
            };
          }
          if (s.id === destSectionId) {
            const newIds = [...s.question_ids];
            newIds.splice(destination.index, 0, questionId);
            return { ...s, question_ids: newIds };
          }
          return s;
        });
      });
    }
  };

  const getQuestionById = (questionId: string): Question | undefined => {
    return allQuestions?.find((q) => q.id === questionId);
  };

  const getSectionTotalPoints = (sectionId: string): number => {
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return 0;
    return section.question_ids.reduce((sum, qId) => {
      const question = getQuestionById(qId);
      return sum + (question?.points || 0);
    }, 0);
  };

  const getAllSelectedQuestionIds = (): string[] => {
    return sections.flatMap((s) => s.question_ids);
  };

  const availableQuestions =
    allQuestions?.filter((q) => !getAllSelectedQuestionIds().includes(q.id)) || [];

  const getTotalPoints = (): number => {
    return sections.reduce((sum, s) => sum + getSectionTotalPoints(s.id), 0);
  };

  const getQuestionTypeLabel = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return 'MC';
      case 'free_text':
        return 'Text';
      case 'file_upload':
        return 'Datei';
      default:
        return type;
    }
  };

  if (isEditing && loadingExam) {
    return (
      <Container size="lg">
        <Stack gap="md">
          <Skeleton height={40} />
          <Skeleton height={200} />
        </Stack>
      </Container>
    );
  }

  return (
    <Container size="lg">
      <Stack gap="lg">
        <div>
          <Title order={2}>{isEditing ? 'Prüfung bearbeiten' : 'Neue Prüfung'}</Title>
          <Text c="dimmed" mt="xs">
            {isEditing
              ? 'Bearbeiten Sie die Prüfungsdetails und Sektionen'
              : 'Erstellen Sie eine neue Prüfung mit Sektionen'}
          </Text>
        </div>

        <form onSubmit={form.onSubmit(handleSubmit)}>
          <Stack gap="lg">
            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Prüfungsdetails
              </Title>
              <Stack gap="md">
                <TextInput
                  label="Titel"
                  placeholder="z.B. Mathematik Klausur Q1"
                  required
                  {...form.getInputProps('title')}
                />
                <Textarea
                  label="Beschreibung"
                  placeholder="Optionale Beschreibung der Prüfung..."
                  minRows={2}
                  {...form.getInputProps('description')}
                />
                <Group>
                  <Checkbox
                    label="Zeitlimit festlegen"
                    checked={form.values.has_time_limit}
                    onChange={(e) => form.setFieldValue('has_time_limit', e.currentTarget.checked)}
                  />
                  {form.values.has_time_limit && (
                    <NumberInput
                      placeholder="Minuten"
                      min={1}
                      max={480}
                      style={{ width: 120 }}
                      {...form.getInputProps('time_limit_minutes')}
                    />
                  )}
                </Group>
                <Checkbox
                  label="Tab-Verlassen sperren"
                  description="Sperrt die Prüfung automatisch, wenn ein Schüler den Tab verlässt"
                  checked={form.values.lock_on_tab_leave}
                  onChange={(e) => form.setFieldValue('lock_on_tab_leave', e.currentTarget.checked)}
                />
              </Stack>
            </Paper>

            <Paper p="lg" radius="md" withBorder>
              <Group justify="space-between" mb="md">
                <div>
                  <Title order={4}>Sektionen</Title>
                  <Text size="sm" c="dimmed">
                    Jede Sektion wird als eigene Seite in der Prüfung angezeigt
                  </Text>
                </div>
                <Group>
                  <Badge size="lg" variant="light">
                    Gesamt: {getTotalPoints()} Punkte
                  </Badge>
                  <Button leftSection={<IconPlus size={16} />} onClick={addSection}>
                    Sektion hinzufügen
                  </Button>
                </Group>
              </Group>

              {sections.length === 0 ? (
                <Text c="dimmed" size="sm" ta="center" py="xl">
                  Keine Sektionen vorhanden. Fügen Sie eine Sektion hinzu, um Aufgaben zuzuweisen.
                </Text>
              ) : (
                <DragDropContext onDragEnd={handleDragEnd}>
                  <Droppable droppableId="sections" type="SECTION">
                    {(provided) => (
                      <Stack gap="md" ref={provided.innerRef} {...provided.droppableProps}>
                        {sections.map((section, sectionIndex) => (
                          <Draggable
                            key={section.id}
                            draggableId={section.id}
                            index={sectionIndex}
                          >
                            {(provided) => (
                              <Paper
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                p="md"
                                withBorder
                                bg="gray.0"
                              >
                                <Group justify="space-between" mb={section.isExpanded ? 'sm' : 0}>
                                  <Group gap="sm">
                                    <div {...provided.dragHandleProps}>
                                      <IconGripVertical size={18} color="gray" />
                                    </div>
                                    <ActionIcon
                                      variant="subtle"
                                      onClick={() => toggleSectionExpanded(section.id)}
                                    >
                                      {section.isExpanded ? (
                                        <IconChevronDown size={18} />
                                      ) : (
                                        <IconChevronRight size={18} />
                                      )}
                                    </ActionIcon>
                                    <div>
                                      <Text fw={600}>{section.title}</Text>
                                      {section.description && (
                                        <Text size="xs" c="dimmed">
                                          {section.description}
                                        </Text>
                                      )}
                                    </div>
                                  </Group>
                                  <Group gap="sm">
                                    <Badge variant="outline">
                                      {section.question_ids.length} Aufgaben
                                    </Badge>
                                    <Badge color="blue">
                                      {getSectionTotalPoints(section.id)} Punkte
                                    </Badge>
                                    <ActionIcon
                                      variant="subtle"
                                      onClick={() => editSection(section.id)}
                                    >
                                      <IconEdit size={16} />
                                    </ActionIcon>
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      onClick={() => deleteSection(section.id)}
                                    >
                                      <IconTrash size={16} />
                                    </ActionIcon>
                                  </Group>
                                </Group>

                                <Collapse in={section.isExpanded}>
                                  <Divider my="sm" />
                                  <Droppable droppableId={section.id} type="QUESTION">
                                    {(provided, snapshot) => (
                                      <Stack
                                        gap="xs"
                                        ref={provided.innerRef}
                                        {...provided.droppableProps}
                                        style={{
                                          minHeight: 60,
                                          backgroundColor: snapshot.isDraggingOver
                                            ? 'var(--mantine-color-blue-0)'
                                            : undefined,
                                          borderRadius: 4,
                                          padding: 4,
                                        }}
                                      >
                                        {section.question_ids.length === 0 ? (
                                          <Text size="sm" c="dimmed" ta="center" py="md">
                                            Ziehen Sie Aufgaben hierher oder wählen Sie aus der
                                            Liste unten
                                          </Text>
                                        ) : (
                                          section.question_ids.map((questionId, index) => {
                                            const question = getQuestionById(questionId);
                                            if (!question) return null;
                                            return (
                                              <Draggable
                                                key={questionId}
                                                draggableId={questionId}
                                                index={index}
                                              >
                                                {(provided) => (
                                                  <Paper
                                                    ref={provided.innerRef}
                                                    {...provided.draggableProps}
                                                    p="xs"
                                                    bg="white"
                                                    withBorder
                                                  >
                                                    <Group
                                                      justify="space-between"
                                                      wrap="nowrap"
                                                    >
                                                      <Group gap="xs" wrap="nowrap">
                                                        <div {...provided.dragHandleProps}>
                                                          <IconGripVertical
                                                            size={14}
                                                            color="gray"
                                                          />
                                                        </div>
                                                        <Text size="sm">
                                                          {index + 1}. {question.title}
                                                        </Text>
                                                        <Badge size="xs">
                                                          {getQuestionTypeLabel(question.type)}
                                                        </Badge>
                                                        <Badge size="xs" variant="outline">
                                                          {question.points} P.
                                                        </Badge>
                                                      </Group>
                                                      <ActionIcon
                                                        variant="subtle"
                                                        color="red"
                                                        size="sm"
                                                        onClick={() =>
                                                          removeQuestionFromSection(
                                                            section.id,
                                                            questionId
                                                          )
                                                        }
                                                      >
                                                        <IconTrash size={12} />
                                                      </ActionIcon>
                                                    </Group>
                                                  </Paper>
                                                )}
                                              </Draggable>
                                            );
                                          })
                                        )}
                                        {provided.placeholder}
                                      </Stack>
                                    )}
                                  </Droppable>
                                </Collapse>
                              </Paper>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </Stack>
                    )}
                  </Droppable>
                </DragDropContext>
              )}
            </Paper>

            <Paper p="lg" radius="md" withBorder>
              <Title order={4} mb="md">
                Verfügbare Aufgaben
              </Title>
              {loadingQuestions ? (
                <Stack gap="xs">
                  <Skeleton height={40} />
                  <Skeleton height={40} />
                </Stack>
              ) : availableQuestions.length === 0 ? (
                <Text c="dimmed" size="sm">
                  {allQuestions?.length === 0
                    ? 'Sie haben noch keine Aufgaben erstellt.'
                    : 'Alle Aufgaben wurden bereits zugewiesen.'}
                </Text>
              ) : (
                <Stack gap="xs">
                  {availableQuestions.map((question) => (
                    <Paper key={question.id} p="sm" bg="gray.0">
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="sm">
                          <Text size="sm" fw={500}>
                            {question.title}
                          </Text>
                          <Badge size="xs">{getQuestionTypeLabel(question.type)}</Badge>
                          <Badge size="xs" variant="outline">
                            {question.points} P.
                          </Badge>
                        </Group>
                        {sections.length > 0 && (
                          <Group gap="xs">
                            {sections.map((section) => (
                              <Button
                                key={section.id}
                                size="xs"
                                variant="light"
                                onClick={() => addQuestionToSection(section.id, question.id)}
                              >
                                + {section.title}
                              </Button>
                            ))}
                          </Group>
                        )}
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Paper>

            <Group justify="flex-end">
              <Button variant="subtle" onClick={() => navigate('/exams')}>
                Abbrechen
              </Button>
              <Button type="submit" loading={creating || updating || savingSections}>
                {isEditing ? 'Speichern' : 'Erstellen'}
              </Button>
            </Group>
          </Stack>
        </form>
      </Stack>

      <Modal
        opened={sectionModalOpened}
        onClose={closeSectionModal}
        title={editingSectionId ? 'Sektion bearbeiten' : 'Neue Sektion'}
      >
        <Stack gap="md">
          <TextInput
            label="Titel"
            placeholder="z.B. Teil A - Grundlagen"
            value={sectionForm.title}
            onChange={(e) => setSectionForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />
          <Textarea
            label="Beschreibung (optional)"
            placeholder="Beschreibung der Sektion..."
            value={sectionForm.description}
            onChange={(e) => setSectionForm((prev) => ({ ...prev, description: e.target.value }))}
            minRows={2}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={closeSectionModal}>
              Abbrechen
            </Button>
            <Button onClick={saveSection}>
              {editingSectionId ? 'Speichern' : 'Hinzufügen'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
};
