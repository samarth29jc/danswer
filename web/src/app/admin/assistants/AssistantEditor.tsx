"use client";

import { generateRandomIconShape, createSVG } from "@/lib/assistantIconUtils";

import { CCPairBasicInfo, DocumentSet, User } from "@/lib/types";
import { Button, Divider, Italic } from "@tremor/react";
import { IsPublicGroupSelector } from "@/components/IsPublicGroupSelector";
import {
  ArrayHelpers,
  ErrorMessage,
  Field,
  FieldArray,
  Form,
  Formik,
  FormikProps,
} from "formik";

import {
  BooleanFormField,
  Label,
  SelectorFormField,
  TextFormField,
} from "@/components/admin/connectors/Field";
import { usePopup } from "@/components/admin/connectors/Popup";
import { getDisplayNameForModel } from "@/lib/hooks";
import { DocumentSetSelectable } from "@/components/documentSet/DocumentSetSelectable";
import { addAssistantToList } from "@/lib/assistants/updateAssistantPreferences";
import { checkLLMSupportsImageInput, destructureValue } from "@/lib/llm/utils";
import { ToolSnapshot } from "@/lib/tools/interfaces";
import { checkUserIsNoAuthUser } from "@/lib/user";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@radix-ui/react-tooltip";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FiInfo } from "react-icons/fi";
import * as Yup from "yup";
import CollapsibleSection from "./CollapsibleSection";
import { SuccessfulPersonaUpdateRedirectType } from "./enums";
import { Persona, StarterMessage } from "./interfaces";
import { buildFinalPrompt, createPersona, updatePersona } from "./lib";
import { Popover } from "@/components/popover/Popover";
import {
  CameraIcon,
  NewChatIcon,
  SwapIcon,
  TrashIcon,
} from "@/components/icons/icons";
import { AdvancedOptionsToggle } from "@/components/AdvancedOptionsToggle";
import { buildImgUrl } from "@/app/chat/files/images/utils";
import { LlmList } from "@/components/llm/LLMList";
import { useAssistants } from "@/components/context/AssistantsContext";
import { debounce } from "lodash";
import { Circle, Recycle } from "@phosphor-icons/react";
import { CustomTooltip } from "@/components/tooltip/CustomTooltip";
import { FullLLMProvider } from "../configuration/llm/interfaces";

function findSearchTool(tools: ToolSnapshot[]) {
  return tools.find((tool) => tool.in_code_tool_id === "SearchTool");
}

function findImageGenerationTool(tools: ToolSnapshot[]) {
  return tools.find((tool) => tool.in_code_tool_id === "ImageGenerationTool");
}

function findInternetSearchTool(tools: ToolSnapshot[]) {
  return tools.find((tool) => tool.in_code_tool_id === "InternetSearchTool");
}

function SubLabel({ children }: { children: string | JSX.Element }) {
  return (
    <div className="text-sm text-description font-description mb-2">
      {children}
    </div>
  );
}

// Create a new component for the starter messages
function StarterMessagesList({
  values,
  arrayHelpers,
  isRefreshing,
}: {
  values: StarterMessage[];
  arrayHelpers: ArrayHelpers;
  isRefreshing: boolean;
}) {
  useEffect(() => {
    const currentLength = values.length;
    if (currentLength < 4) {
      // Add empty messages until we have 4
      for (let i = currentLength; i < 4; i++) {
        arrayHelpers.push({
          name: "",
          description: "",
          message: "",
        });
      }
    } else if (currentLength > 4) {
      // Remove extra messages if we have more than 4
      for (let i = currentLength - 1; i >= 4; i--) {
        arrayHelpers.remove(i);
      }
    }
  }, []); // Empty dependency array means this only runs once on mount

  return (
    <div className="w-full grid grid-cols-2 gap-6">
      {values.map((starterMessage: StarterMessage, index: number) => (
        <div
          key={index}
          className="bg-white border border-border rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200 p-6"
        >
          <div className="space-y-5">
            {isRefreshing ? (
              <div className="w-full">
                <div className="w-full">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>

                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-10 w-full bg-gray-200 rounded animate-pulse" />
                </div>

                <div>
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse mb-2" />
                  <div className="h-24 w-full bg-gray-200 rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <>
                <div>
                  <Label small className="text-sm font-medium text-gray-700">
                    Name
                  </Label>
                  <SubLabel>
                    Shows up as the "title" for this Starter Message. For
                    example, "Write an email".
                  </SubLabel>
                  <Field
                    name={`starter_messages.${index}.name`}
                    className="mt-1 w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    autoComplete="off"
                    placeholder="Enter a name..."
                  />
                  <ErrorMessage
                    name={`starter_messages.${index}.name`}
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <Label small className="text-sm font-medium text-gray-700">
                    Description
                  </Label>
                  <SubLabel>
                    A description which tells the user what they might want to
                    use this Starter Message for.
                  </SubLabel>
                  <Field
                    name={`starter_messages.${index}.description`}
                    className="text-sm mt-1 w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                    autoComplete="off"
                    as="textarea"
                    placeholder="Enter a description..."
                  />
                  <ErrorMessage
                    name={`starter_messages.${index}.description`}
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>

                <div>
                  <Label small className="text-sm font-medium text-gray-700">
                    Message
                  </Label>
                  <SubLabel>
                    The actual message to be sent as the initial user message.
                  </SubLabel>
                  <Field
                    name={`starter_messages.${index}.message`}
                    className="mt-1  text-sm  w-full px-4 py-2.5 bg-background border border-border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition min-h-[100px] resize-y"
                    as="textarea"
                    autoComplete="off"
                    placeholder="Enter the message..."
                  />
                  <ErrorMessage
                    name={`starter_messages.${index}.message`}
                    component="div"
                    className="text-red-500 text-sm mt-1"
                  />
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function AssistantEditor({
  existingPersona,
  ccPairs,
  documentSets,
  user,
  defaultPublic,
  redirectType,
  llmProviders,
  tools,
  shouldAddAssistantToUserPreferences,
  admin,
}: {
  existingPersona?: Persona | null;
  ccPairs: CCPairBasicInfo[];
  documentSets: DocumentSet[];
  user: User | null;
  defaultPublic: boolean;
  redirectType: SuccessfulPersonaUpdateRedirectType;
  llmProviders: FullLLMProvider[];
  tools: ToolSnapshot[];
  shouldAddAssistantToUserPreferences?: boolean;
  admin?: boolean;
}) {
  const { refreshAssistants, isImageGenerationAvailable } = useAssistants();
  const router = useRouter();

  const { popup, setPopup } = usePopup();

  const colorOptions = [
    "#FF6FBF",
    "#6FB1FF",
    "#B76FFF",
    "#FFB56F",
    "#6FFF8D",
    "#FF6F6F",
    "#6FFFFF",
  ];

  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // state to persist across formik reformatting
  const [defautIconColor, _setDeafultIconColor] = useState(
    colorOptions[Math.floor(Math.random() * colorOptions.length)]
  );
  const [isRefreshing, setIsRefreshing] = useState(false);

  const [defaultIconShape, setDefaultIconShape] = useState<any>(null);

  useEffect(() => {
    if (defaultIconShape === null) {
      setDefaultIconShape(generateRandomIconShape().encodedGrid);
    }
  }, [defaultIconShape]);

  const [isIconDropdownOpen, setIsIconDropdownOpen] = useState(false);

  const [removePersonaImage, setRemovePersonaImage] = useState(false);

  const autoStarterMessageEnabled = useMemo(
    () => llmProviders.length > 0,
    [llmProviders.length]
  );
  const isUpdate = existingPersona !== undefined && existingPersona !== null;
  const existingPrompt = existingPersona?.prompts[0] ?? null;
  const defaultProvider = llmProviders.find(
    (llmProvider) => llmProvider.is_default_provider
  );
  const defaultModelName = defaultProvider?.default_model_name;
  const providerDisplayNameToProviderName = new Map<string, string>();
  llmProviders.forEach((llmProvider) => {
    providerDisplayNameToProviderName.set(
      llmProvider.name,
      llmProvider.provider
    );
  });

  const modelOptionsByProvider = new Map<string, Option<string>[]>();
  llmProviders.forEach((llmProvider) => {
    const providerOptions = llmProvider.model_names.map((modelName) => {
      return {
        name: getDisplayNameForModel(modelName),
        value: modelName,
      };
    });
    modelOptionsByProvider.set(llmProvider.name, providerOptions);
  });

  const personaCurrentToolIds =
    existingPersona?.tools.map((tool) => tool.id) || [];

  const searchTool = findSearchTool(tools);
  const imageGenerationTool = findImageGenerationTool(tools);
  const internetSearchTool = findInternetSearchTool(tools);

  const customTools = tools.filter(
    (tool) =>
      tool.in_code_tool_id !== searchTool?.in_code_tool_id &&
      tool.in_code_tool_id !== imageGenerationTool?.in_code_tool_id &&
      tool.in_code_tool_id !== internetSearchTool?.in_code_tool_id
  );

  const availableTools = [
    ...customTools,
    ...(searchTool ? [searchTool] : []),
    ...(imageGenerationTool ? [imageGenerationTool] : []),
    ...(internetSearchTool ? [internetSearchTool] : []),
  ];
  const enabledToolsMap: { [key: number]: boolean } = {};
  availableTools.forEach((tool) => {
    enabledToolsMap[tool.id] = personaCurrentToolIds.includes(tool.id);
  });

  const initialValues = {
    name: existingPersona?.name ?? "",
    description: existingPersona?.description ?? "",
    system_prompt: existingPrompt?.system_prompt ?? "",
    task_prompt: existingPrompt?.task_prompt ?? "",
    is_public: existingPersona?.is_public ?? defaultPublic,
    document_set_ids:
      existingPersona?.document_sets?.map((documentSet) => documentSet.id) ??
      ([] as number[]),
    num_chunks: existingPersona?.num_chunks ?? null,
    search_start_date: existingPersona?.search_start_date
      ? existingPersona?.search_start_date.toString().split("T")[0]
      : null,
    include_citations: existingPersona?.prompts[0]?.include_citations ?? true,
    llm_relevance_filter: existingPersona?.llm_relevance_filter ?? false,
    llm_model_provider_override:
      existingPersona?.llm_model_provider_override ?? null,
    llm_model_version_override:
      existingPersona?.llm_model_version_override ?? null,
    starter_messages: existingPersona?.starter_messages ?? [
      {
        name: "",
        description: "",
        message: "",
      },
      {
        name: "",
        description: "",
        message: "",
      },
      {
        name: "",
        description: "",
        message: "",
      },
      {
        name: "",
        description: "",
        message: "",
      },
    ],
    enabled_tools_map: enabledToolsMap,
    icon_color: existingPersona?.icon_color ?? defautIconColor,
    icon_shape: existingPersona?.icon_shape ?? defaultIconShape,
    uploaded_image: null,

    // EE Only
    groups: existingPersona?.groups ?? [],
  };

  interface AssistantPrompt {
    message: string;
    description: string;
    name: string;
  }

  // Create debounced refresh function
  const debouncedRefreshPrompts = debounce(
    async (values: any, setFieldValue: any) => {
      if (!autoStarterMessageEnabled) {
        return;
      }
      setIsRefreshing(true);
      try {
        const response = await fetch("/api/persona/assistant-prompt-refresh", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: values.name,
            description: values.description,
            document_set_ids: values.document_set_ids,
          }),
        });

        const data: AssistantPrompt = await response.json();
        if (response.ok) {
          setFieldValue("starter_messages", data);
        }
      } catch (error) {
        console.error("Failed to refresh prompts:", error);
      } finally {
        setIsRefreshing(false);
      }
    },
    1000
  );

  const [isRequestSuccessful, setIsRequestSuccessful] = useState(false);

  return (
    <div>
      {popup}
      <Formik
        enableReinitialize={true}
        initialValues={initialValues}
        validationSchema={Yup.object()
          .shape({
            name: Yup.string().required(
              "Must provide a name for the Assistant"
            ),
            description: Yup.string().required(
              "Must provide a description for the Assistant"
            ),
            system_prompt: Yup.string(),
            task_prompt: Yup.string(),
            is_public: Yup.boolean().required(),
            document_set_ids: Yup.array().of(Yup.number()),
            num_chunks: Yup.number().nullable(),
            include_citations: Yup.boolean().required(),
            llm_relevance_filter: Yup.boolean().required(),
            llm_model_version_override: Yup.string().nullable(),
            llm_model_provider_override: Yup.string().nullable(),
            starter_messages: Yup.array()
              .of(
                Yup.object().shape({
                  name: Yup.string().required(
                    "Each starter message must have a name"
                  ),
                  description: Yup.string().required(
                    "Each starter message must have a description"
                  ),
                  message: Yup.string().required(
                    "Each starter message must have a message"
                  ),
                })
              )
              .length(4),
            search_start_date: Yup.date().nullable(),
            icon_color: Yup.string(),
            icon_shape: Yup.number(),
            uploaded_image: Yup.mixed().nullable(),
            // EE Only
            groups: Yup.array().of(Yup.number()),
          })
          .test(
            "system-prompt-or-task-prompt",
            "Must provide either Instructions or Reminders (Advanced)",
            function (values) {
              const systemPromptSpecified =
                values.system_prompt && values.system_prompt.trim().length > 0;
              const taskPromptSpecified =
                values.task_prompt && values.task_prompt.trim().length > 0;

              if (systemPromptSpecified || taskPromptSpecified) {
                return true;
              }

              return this.createError({
                path: "system_prompt",
                message:
                  "Must provide either Instructions or Reminders (Advanced)",
              });
            }
          )}
        onSubmit={async (values, formikHelpers) => {
          if (
            values.llm_model_provider_override &&
            !values.llm_model_version_override
          ) {
            setPopup({
              type: "error",
              message:
                "Must select a model if a non-default LLM provider is chosen.",
            });
            return;
          }

          formikHelpers.setSubmitting(true);
          let enabledTools = Object.keys(values.enabled_tools_map)
            .map((toolId) => Number(toolId))
            .filter((toolId) => values.enabled_tools_map[toolId]);
          const searchToolEnabled = searchTool
            ? enabledTools.includes(searchTool.id)
            : false;
          const imageGenerationToolEnabled = imageGenerationTool
            ? enabledTools.includes(imageGenerationTool.id)
            : false;

          if (imageGenerationToolEnabled) {
            if (
              // model must support image input for image generation
              // to work
              !checkLLMSupportsImageInput(
                values.llm_model_version_override || defaultModelName || ""
              )
            ) {
              enabledTools = enabledTools.filter(
                (toolId) => toolId !== imageGenerationTool!.id
              );
            }
          }

          // if disable_retrieval is set, set num_chunks to 0
          // to tell the backend to not fetch any documents
          const numChunks = searchToolEnabled ? values.num_chunks || 10 : 0;

          // don't set groups if marked as public
          const groups = values.is_public ? [] : values.groups;

          let promptResponse;
          let personaResponse;
          if (isUpdate) {
            [promptResponse, personaResponse] = await updatePersona({
              id: existingPersona.id,
              existingPromptId: existingPrompt?.id,
              ...values,
              search_start_date: values.search_start_date
                ? new Date(values.search_start_date)
                : null,
              num_chunks: numChunks,
              users:
                user && !checkUserIsNoAuthUser(user.id) ? [user.id] : undefined,
              groups,
              tool_ids: enabledTools,
              remove_image: removePersonaImage,
            });
          } else {
            [promptResponse, personaResponse] = await createPersona({
              ...values,
              is_default_persona: admin!,
              num_chunks: numChunks,
              search_start_date: values.search_start_date
                ? new Date(values.search_start_date)
                : null,
              users:
                user && !checkUserIsNoAuthUser(user.id) ? [user.id] : undefined,
              groups,
              tool_ids: enabledTools,
            });
          }

          let error = null;
          if (!promptResponse.ok) {
            error = await promptResponse.text();
          }
          if (!personaResponse) {
            error = "Failed to create Assistant - no response received";
          } else if (!personaResponse.ok) {
            error = await personaResponse.text();
          }

          if (error || !personaResponse) {
            setPopup({
              type: "error",
              message: `Failed to create Assistant - ${error}`,
            });
            formikHelpers.setSubmitting(false);
          } else {
            const assistant = await personaResponse.json();
            const assistantId = assistant.id;
            if (
              shouldAddAssistantToUserPreferences &&
              user?.preferences?.chosen_assistants
            ) {
              const success = await addAssistantToList(assistantId);
              if (success) {
                setPopup({
                  message: `"${assistant.name}" has been added to your list.`,
                  type: "success",
                });
                router.refresh();
              } else {
                setPopup({
                  message: `"${assistant.name}" could not be added to your list.`,
                  type: "error",
                });
              }
            }
            await refreshAssistants();
            router.push(
              redirectType === SuccessfulPersonaUpdateRedirectType.ADMIN
                ? `/admin/assistants?u=${Date.now()}`
                : `/chat?assistantId=${assistantId}`
            );
            setIsRequestSuccessful(true);
          }
        }}
      >
        {({
          isSubmitting,
          values,
          setFieldValue,
          errors,

          ...formikProps
        }: FormikProps<any>) => {
          function toggleToolInValues(toolId: number) {
            const updatedEnabledToolsMap = {
              ...values.enabled_tools_map,
              [toolId]: !values.enabled_tools_map[toolId],
            };
            setFieldValue("enabled_tools_map", updatedEnabledToolsMap);
          }

          function searchToolEnabled() {
            return searchTool && values.enabled_tools_map[searchTool.id]
              ? true
              : false;
          }

          // model must support image input for image generation
          // to work
          const currentLLMSupportsImageOutput = checkLLMSupportsImageInput(
            values.llm_model_version_override || defaultModelName || ""
          );

          useEffect(() => {
            // Only refresh if we have required fields and no errors
            if (
              values.name &&
              values.description &&
              Object.keys(errors).filter(
                (key) => !key.startsWith("starter_messages")
              ).length === 0
            ) {
              debouncedRefreshPrompts(values, setFieldValue);
            } else {
              console.log("not refreshing");
              console.log(errors);
            }
          }, [
            values.name,
            values.description,
            values.document_set_ids,
            errors,
          ]);

          return (
            <Form className="w-full text-text-950">
              <div className="w-full flex gap-x-2 justify-center">
                <Popover
                  open={isIconDropdownOpen}
                  onOpenChange={setIsIconDropdownOpen}
                  content={
                    <div
                      className="p-1 cursor-pointer border-dashed rounded-full flex border border-border border-2 border-dashed"
                      style={{
                        borderStyle: "dashed",
                        borderWidth: "1.5px",
                        borderSpacing: "4px",
                      }}
                      onClick={() => setIsIconDropdownOpen(!isIconDropdownOpen)}
                    >
                      {values.uploaded_image ? (
                        <img
                          src={URL.createObjectURL(values.uploaded_image)}
                          alt="Uploaded assistant icon"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : existingPersona?.uploaded_image_id &&
                        !removePersonaImage ? (
                        <img
                          src={buildImgUrl(existingPersona?.uploaded_image_id)}
                          alt="Uploaded assistant icon"
                          className="w-12 h-12 rounded-full object-cover"
                        />
                      ) : (
                        createSVG(
                          {
                            encodedGrid: values.icon_shape,
                            filledSquares: 0,
                          },
                          values.icon_color,
                          undefined,
                          true
                        )
                      )}
                    </div>
                  }
                  popover={
                    <div className="bg-white text-text-800 flex flex-col gap-y-1 w-[300px] border border-border rounded-lg shadow-lg p-2">
                      <label className="block w-full flex gap-x-2 text-left items-center px-4 py-2 hover:bg-background-100 rounded cursor-pointer">
                        <CameraIcon />
                        Upload {values.uploaded_image && " New "} Photo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              setFieldValue("uploaded_image", file);
                              setIsIconDropdownOpen(false);
                            }
                          }}
                        />
                      </label>

                      {values.uploaded_image && (
                        <button
                          onClick={() => {
                            setFieldValue("uploaded_image", null);
                            setRemovePersonaImage(false);
                          }}
                          className="block w-full items-center flex gap-x-2 text-left px-4 py-2 hover:bg-background-100 rounded"
                        >
                          <TrashIcon />
                          {removePersonaImage
                            ? "Revert to Previous "
                            : "Remove "}
                          Image
                        </button>
                      )}

                      {!values.uploaded_image &&
                        (!existingPersona?.uploaded_image_id ||
                          removePersonaImage) && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const newShape = generateRandomIconShape();
                              const randomColor =
                                colorOptions[
                                  Math.floor(
                                    Math.random() * colorOptions.length
                                  )
                                ];
                              setFieldValue("icon_shape", newShape.encodedGrid);
                              setFieldValue("icon_color", randomColor);
                            }}
                            className="block w-full items-center flex gap-x-2 text-left px-4 py-2 hover:bg-background-100 rounded"
                          >
                            <NewChatIcon />
                            Generate New Icon
                          </button>
                        )}

                      {existingPersona?.uploaded_image_id &&
                        removePersonaImage &&
                        !values.uploaded_image && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemovePersonaImage(false);
                              setFieldValue("uploaded_image", null);
                            }}
                            className="block w-full items-center flex gap-x-2 text-left px-4 py-2 hover:bg-background-100 rounded"
                          >
                            <SwapIcon />
                            Revert to Previous Image
                          </button>
                        )}

                      {existingPersona?.uploaded_image_id &&
                        !removePersonaImage &&
                        !values.uploaded_image && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemovePersonaImage(true);
                            }}
                            className="block w-full items-center flex gap-x-2 text-left px-4 py-2 hover:bg-background-100 rounded"
                          >
                            <TrashIcon />
                            Remove Image
                          </button>
                        )}
                    </div>
                  }
                  align="start"
                  side="bottom"
                />
                <TooltipProvider delayDuration={50}>
                  <Tooltip>
                    <TooltipTrigger>
                      <FiInfo size={12} />
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center">
                      <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                        This icon will visually represent your Assistant
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <TextFormField
                name="name"
                tooltip="Used to identify the Assistant in the UI."
                label="Name"
                placeholder="e.g. 'Email Assistant'"
              />

              <TextFormField
                tooltip="Used for identifying assistants and their use cases."
                name="description"
                label="Description"
                placeholder="e.g. 'Use this Assistant to help draft professional emails'"
              />

              <TextFormField
                tooltip="Gives your assistant a prime directive"
                name="system_prompt"
                label="Instructions"
                isTextArea={true}
                placeholder="e.g. 'You are a professional email writing assistant that always uses a polite enthusiastic tone, emphasizes action items, and leaves blanks for the human to fill in when you have unknowns'"
                onChange={(e) => {
                  setFieldValue("system_prompt", e.target.value);
                }}
              />

              <div>
                <div className="flex gap-x-2 items-center">
                  <div className="block  font-medium text-base">
                    Default AI Model{" "}
                  </div>
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger>
                        <FiInfo size={12} />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                          Select a Large Language Model (Generative AI model) to
                          power this Assistant
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <p className="my-1 font-description text-base text-text-400">
                  Your assistant will use the user&apos;s set default unless
                  otherwise specified below.
                  {admin &&
                    user?.preferences.default_model &&
                    `  Your current (user-specific) default model is ${getDisplayNameForModel(
                      destructureValue(user?.preferences?.default_model!)
                        .modelName
                    )}`}
                </p>
                {admin ? (
                  <div className="mb-2 flex items-starts">
                    <div className="w-96">
                      <SelectorFormField
                        defaultValue={`User default`}
                        name="llm_model_provider_override"
                        options={llmProviders.map((llmProvider) => ({
                          name: llmProvider.name,
                          value: llmProvider.name,
                          icon: llmProvider.icon,
                        }))}
                        includeDefault={true}
                        onSelect={(selected) => {
                          if (selected !== values.llm_model_provider_override) {
                            setFieldValue("llm_model_version_override", null);
                          }
                          setFieldValue(
                            "llm_model_provider_override",
                            selected
                          );
                        }}
                      />
                    </div>

                    {values.llm_model_provider_override && (
                      <div className="w-96 ml-4">
                        <SelectorFormField
                          name="llm_model_version_override"
                          options={
                            modelOptionsByProvider.get(
                              values.llm_model_provider_override
                            ) || []
                          }
                          maxHeight="max-h-72"
                        />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="max-w-sm">
                    <LlmList
                      scrollable
                      userDefault={
                        user?.preferences?.default_model!
                          ? destructureValue(user?.preferences?.default_model!)
                              .modelName
                          : null
                      }
                      llmProviders={llmProviders}
                      currentLlm={values.llm_model_version_override}
                      onSelect={(value: string | null) => {
                        if (value !== null) {
                          const { modelName, provider, name } =
                            destructureValue(value);
                          setFieldValue(
                            "llm_model_version_override",
                            modelName
                          );
                          setFieldValue("llm_model_provider_override", name);
                        } else {
                          setFieldValue("llm_model_version_override", null);
                          setFieldValue("llm_model_provider_override", null);
                        }
                      }}
                    />
                  </div>
                )}
              </div>
              <div>
                <div className="flex gap-x-2 items-center">
                  <div className="block font-medium text-base">
                    Capabilities{" "}
                  </div>
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger>
                        <FiInfo size={12} />
                      </TooltipTrigger>
                      <TooltipContent side="top" align="center">
                        <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                          You can give your assistant advanced capabilities like
                          image generation
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <div className="block text-sm font-description text-subtle">
                    Advanced
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-y-4  ml-1">
                  {imageGenerationTool && (
                    <TooltipProvider delayDuration={50}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-fit ${
                              !currentLLMSupportsImageOutput ||
                              !isImageGenerationAvailable
                                ? "opacity-70 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <BooleanFormField
                              removeIndent
                              name={`enabled_tools_map.${imageGenerationTool.id}`}
                              label="Image Generation Tool"
                              onChange={() => {
                                toggleToolInValues(imageGenerationTool.id);
                              }}
                              disabled={
                                !currentLLMSupportsImageOutput ||
                                !isImageGenerationAvailable
                              }
                            />
                          </div>
                        </TooltipTrigger>
                        {!currentLLMSupportsImageOutput ? (
                          <TooltipContent side="top" align="center">
                            <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                              To use Image Generation, select GPT-4o or another
                              image compatible model as the default model for
                              this Assistant.
                            </p>
                          </TooltipContent>
                        ) : (
                          !isImageGenerationAvailable && (
                            <TooltipContent side="top" align="center">
                              <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                                Image Generation requires an OpenAI or Azure
                                Dalle configuration.
                              </p>
                            </TooltipContent>
                          )
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {searchTool && (
                    <TooltipProvider delayDuration={50}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-fit ${
                              ccPairs.length === 0
                                ? "opacity-70 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            <BooleanFormField
                              name={`enabled_tools_map.${searchTool.id}`}
                              label="Search Tool"
                              removeIndent
                              onChange={() => {
                                setFieldValue("num_chunks", null);
                                toggleToolInValues(searchTool.id);
                              }}
                              disabled={ccPairs.length === 0}
                            />
                          </div>
                        </TooltipTrigger>
                        {ccPairs.length === 0 && (
                          <TooltipContent side="top" align="center">
                            <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                              To use the Search Tool, you need to have at least
                              one Connector-Credential pair configured.
                            </p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  )}

                  {ccPairs.length > 0 && searchTool && (
                    <>
                      {searchToolEnabled() && (
                        <CollapsibleSection prompt="Configure Search">
                          <div>
                            {ccPairs.length > 0 && (
                              <>
                                <Label small>Document Sets</Label>
                                <div>
                                  <SubLabel>
                                    <>
                                      Select which{" "}
                                      {!user || user.role === "admin" ? (
                                        <Link
                                          href="/admin/documents/sets"
                                          className="text-blue-500"
                                          target="_blank"
                                        >
                                          Document Sets
                                        </Link>
                                      ) : (
                                        "Document Sets"
                                      )}{" "}
                                      this Assistant should search through. If
                                      none are specified, the Assistant will
                                      search through all available documents in
                                      order to try and respond to queries.
                                    </>
                                  </SubLabel>
                                </div>

                                {documentSets.length > 0 ? (
                                  <FieldArray
                                    name="document_set_ids"
                                    render={(arrayHelpers: ArrayHelpers) => (
                                      <div>
                                        <div className="mb-3 mt-2 flex gap-2 flex-wrap text-sm">
                                          {documentSets.map((documentSet) => {
                                            const ind =
                                              values.document_set_ids.indexOf(
                                                documentSet.id
                                              );
                                            const isSelected = ind !== -1;
                                            return (
                                              <DocumentSetSelectable
                                                key={documentSet.id}
                                                documentSet={documentSet}
                                                isSelected={isSelected}
                                                onSelect={() => {
                                                  if (isSelected) {
                                                    arrayHelpers.remove(ind);
                                                  } else {
                                                    arrayHelpers.push(
                                                      documentSet.id
                                                    );
                                                  }
                                                }}
                                              />
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
                                  />
                                ) : (
                                  <Italic className="text-sm">
                                    No Document Sets available.{" "}
                                    {user?.role !== "admin" && (
                                      <>
                                        If this functionality would be useful,
                                        reach out to the administrators of
                                        Danswer for assistance.
                                      </>
                                    )}
                                  </Italic>
                                )}

                                <div className="mt-4  flex flex-col gap-y-4">
                                  <TextFormField
                                    small={true}
                                    name="num_chunks"
                                    label="Number of Context Documents"
                                    tooltip="How many of the top matching document sections to feed the LLM for context when generating a response"
                                    placeholder="Defaults to 10"
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (
                                        value === "" ||
                                        /^[0-9]+$/.test(value)
                                      ) {
                                        setFieldValue("num_chunks", value);
                                      }
                                    }}
                                  />

                                  <TextFormField
                                    width="max-w-xl"
                                    type="date"
                                    small
                                    subtext="Documents prior to this date will not be referenced by the search tool"
                                    optional
                                    label="Search Start Date"
                                    value={values.search_start_date}
                                    name="search_start_date"
                                  />

                                  <BooleanFormField
                                    small
                                    removeIndent
                                    alignTop
                                    name="llm_relevance_filter"
                                    label="Apply LLM Relevance Filter"
                                    subtext={
                                      "If enabled, the LLM will filter out chunks that are not relevant to the user query."
                                    }
                                  />

                                  <BooleanFormField
                                    small
                                    removeIndent
                                    alignTop
                                    name="include_citations"
                                    label="Include Citations"
                                    subtext={`
                                      If set, the response will include bracket citations ([1], [2], etc.) 
                                      for each document used by the LLM to help inform the response. This is 
                                      the same technique used by the default Assistants. In general, we recommend 
                                      to leave this enabled in order to increase trust in the LLM answer.`}
                                  />
                                </div>
                              </>
                            )}
                          </div>
                        </CollapsibleSection>
                      )}
                    </>
                  )}

                  {internetSearchTool && (
                    <BooleanFormField
                      removeIndent
                      name={`enabled_tools_map.${internetSearchTool.id}`}
                      label={internetSearchTool.display_name}
                      onChange={() => {
                        toggleToolInValues(internetSearchTool.id);
                      }}
                    />
                  )}

                  {customTools.length > 0 && (
                    <>
                      {customTools.map((tool) => (
                        <BooleanFormField
                          removeIndent
                          alignTop={tool.description != null}
                          key={tool.id}
                          name={`enabled_tools_map.${tool.id}`}
                          label={tool.display_name}
                          subtext={tool.description}
                          onChange={() => {
                            toggleToolInValues(tool.id);
                          }}
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>

              <div className="mb-6 max-w-5xl w-full flex flex-col">
                <div className="flex gap-x-2 items-center">
                  <div className="block font-medium text-base">
                    Starter Messages
                  </div>
                </div>

                <SubLabel>
                  Add pre-defined messages to help users get started. Only the
                  first 4 will be displayed.
                </SubLabel>
                <div className="relative w-fit">
                  <TooltipProvider delayDuration={50}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div>
                          <Button
                            type="button"
                            size="xs"
                            onClick={() =>
                              debouncedRefreshPrompts(values, setFieldValue)
                            }
                            disabled={
                              !autoStarterMessageEnabled ||
                              isRefreshing ||
                              (Object.keys(errors).length > 0 &&
                                Object.keys(errors).some(
                                  (key) => !key.startsWith("starter_messages")
                                ))
                            }
                            className={`
                            px-3 py-2
                            mr-auto
                            my-2
                            flex gap-x-2
                            text-sm font-medium
                            rounded-lg shadow-sm
                            items-center gap-2
                            transition-colors duration-200
                            ${
                              isRefreshing || !autoStarterMessageEnabled
                                ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                                : "bg-blue-50 text-blue-600 hover:bg-blue-100 active:bg-blue-200"
                            }
                          `}
                          >
                            <div className="flex items-center gap-x-2">
                              {isRefreshing ? (
                                <Recycle className="w-4 h-4 animate-spin text-gray-400" />
                              ) : (
                                <SwapIcon className="w-4 h-4 text-blue-600" />
                              )}
                              {isRefreshing ? "Generating..." : "Regenerate"}
                            </div>
                          </Button>
                        </div>
                      </TooltipTrigger>
                      {!autoStarterMessageEnabled && (
                        <TooltipContent side="top" align="center">
                          <p className="bg-background-900 max-w-[200px] mb-1 text-sm rounded-lg p-1.5 text-white">
                            No LLM providers configured. Generation is not
                            available.
                          </p>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <div className="w-full">
                  <FieldArray
                    name="starter_messages"
                    render={(arrayHelpers: ArrayHelpers) => (
                      <StarterMessagesList
                        isRefreshing={isRefreshing}
                        values={values.starter_messages}
                        arrayHelpers={arrayHelpers}
                      />
                    )}
                  />
                </div>
              </div>
              <Divider />
              <AdvancedOptionsToggle
                showAdvancedOptions={showAdvancedOptions}
                setShowAdvancedOptions={setShowAdvancedOptions}
              />

              {showAdvancedOptions && (
                <>
                  {llmProviders.length > 0 && (
                    <>
                      <TextFormField
                        name="task_prompt"
                        label="Reminders (Optional)"
                        isTextArea={true}
                        placeholder="e.g. 'Remember to reference all of the points mentioned in my message to you and focus on identifying action items that can move things forward'"
                        onChange={(e) => {
                          setFieldValue("task_prompt", e.target.value);
                        }}
                        explanationText="Learn about prompting in our docs!"
                        explanationLink="https://docs.danswer.dev/guides/assistants"
                      />
                    </>
                  )}

                  <IsPublicGroupSelector
                    formikProps={{
                      values,
                      isSubmitting,
                      setFieldValue,
                      errors,
                      ...formikProps,
                    }}
                    objectName="assistant"
                    enforceGroupSelection={false}
                  />
                </>
              )}

              <div className="flex">
                <Button
                  className="mx-auto"
                  color="green"
                  size="md"
                  type="submit"
                  disabled={isSubmitting || isRequestSuccessful}
                >
                  {isUpdate ? "Update!" : "Create!"}
                </Button>
              </div>
            </Form>
          );
        }}
      </Formik>
    </div>
  );
}
