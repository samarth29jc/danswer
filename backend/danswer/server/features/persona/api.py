import uuid
from uuid import UUID

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Query
from fastapi import UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from danswer.auth.users import current_admin_user
from danswer.auth.users import current_curator_or_admin_user
from danswer.auth.users import current_user
from danswer.configs.constants import FileOrigin
from danswer.configs.constants import NotificationType
from danswer.db.document_set import get_document_sets_by_ids
from danswer.db.engine import get_session
from danswer.db.models import User
from danswer.db.notification import create_notification
from danswer.db.persona import create_update_persona
from danswer.db.persona import get_persona_by_id
from danswer.db.persona import get_personas
from danswer.db.persona import mark_persona_as_deleted
from danswer.db.persona import mark_persona_as_not_deleted
from danswer.db.persona import update_all_personas_display_priority
from danswer.db.persona import update_persona_public_status
from danswer.db.persona import update_persona_shared_users
from danswer.db.persona import update_persona_visibility
from danswer.document_index.document_index_utils import get_both_index_names
from danswer.document_index.factory import get_default_document_index
from danswer.file_store.file_store import get_default_file_store
from danswer.file_store.models import ChatFileType
from danswer.llm.answering.prompts.utils import build_dummy_prompt
from danswer.llm.factory import get_default_llms
from danswer.search.models import IndexFilters
from danswer.search.models import InferenceChunk
from danswer.server.features.persona.models import CreatePersonaRequest
from danswer.server.features.persona.models import GeneratePersonaPromptRequest
from danswer.server.features.persona.models import ImageGenerationToolStatus
from danswer.server.features.persona.models import PersonaSharedNotificationData
from danswer.server.features.persona.models import PersonaSnapshot
from danswer.server.features.persona.models import PromptTemplateResponse
from danswer.server.models import DisplayPriorityRequest
from danswer.tools.utils import is_image_generation_available
from danswer.utils.logger import setup_logger

logger = setup_logger()


admin_router = APIRouter(prefix="/admin/persona")
basic_router = APIRouter(prefix="/persona")


class IsVisibleRequest(BaseModel):
    is_visible: bool


class IsPublicRequest(BaseModel):
    is_public: bool


@admin_router.patch("/{persona_id}/visible")
def patch_persona_visibility(
    persona_id: int,
    is_visible_request: IsVisibleRequest,
    user: User | None = Depends(current_curator_or_admin_user),
    db_session: Session = Depends(get_session),
) -> None:
    update_persona_visibility(
        persona_id=persona_id,
        is_visible=is_visible_request.is_visible,
        db_session=db_session,
        user=user,
    )


@basic_router.patch("/{persona_id}/public")
def patch_user_presona_public_status(
    persona_id: int,
    is_public_request: IsPublicRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    try:
        update_persona_public_status(
            persona_id=persona_id,
            is_public=is_public_request.is_public,
            db_session=db_session,
            user=user,
        )
    except ValueError as e:
        logger.exception("Failed to update persona public status")
        raise HTTPException(status_code=403, detail=str(e))


@admin_router.put("/display-priority")
def patch_persona_display_priority(
    display_priority_request: DisplayPriorityRequest,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> None:
    update_all_personas_display_priority(
        display_priority_map=display_priority_request.display_priority_map,
        db_session=db_session,
    )


@admin_router.get("")
def list_personas_admin(
    user: User | None = Depends(current_curator_or_admin_user),
    db_session: Session = Depends(get_session),
    include_deleted: bool = False,
    get_editable: bool = Query(False, description="If true, return editable personas"),
) -> list[PersonaSnapshot]:
    return [
        PersonaSnapshot.from_model(persona)
        for persona in get_personas(
            db_session=db_session,
            user=user,
            get_editable=get_editable,
            include_deleted=include_deleted,
            joinedload_all=True,
        )
    ]


@admin_router.patch("/{persona_id}/undelete")
def undelete_persona(
    persona_id: int,
    user: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> None:
    mark_persona_as_not_deleted(
        persona_id=persona_id,
        user=user,
        db_session=db_session,
    )


# used for assistat profile pictures
@admin_router.post("/upload-image")
def upload_file(
    file: UploadFile,
    db_session: Session = Depends(get_session),
    _: User | None = Depends(current_user),
) -> dict[str, str]:
    file_store = get_default_file_store(db_session)
    file_type = ChatFileType.IMAGE
    file_id = str(uuid.uuid4())
    file_store.save_file(
        file_name=file_id,
        content=file.file,
        display_name=file.filename,
        file_origin=FileOrigin.CHAT_UPLOAD,
        file_type=file.content_type or file_type.value,
    )
    return {"file_id": file_id}


"""Endpoints for all"""


@basic_router.post("")
def create_persona(
    create_persona_request: CreatePersonaRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> PersonaSnapshot:
    return create_update_persona(
        persona_id=None,
        create_persona_request=create_persona_request,
        user=user,
        db_session=db_session,
    )


@basic_router.patch("/{persona_id}")
def update_persona(
    persona_id: int,
    update_persona_request: CreatePersonaRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> PersonaSnapshot:
    return create_update_persona(
        persona_id=persona_id,
        create_persona_request=update_persona_request,
        user=user,
        db_session=db_session,
    )


class PersonaShareRequest(BaseModel):
    user_ids: list[UUID]


# We notify each user when a user is shared with them
@basic_router.patch("/{persona_id}/share")
def share_persona(
    persona_id: int,
    persona_share_request: PersonaShareRequest,
    user: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    update_persona_shared_users(
        persona_id=persona_id,
        user_ids=persona_share_request.user_ids,
        user=user,
        db_session=db_session,
    )

    for user_id in persona_share_request.user_ids:
        # Don't notify the user that they have access to their own persona
        if user_id != user.id:
            create_notification(
                user_id=user_id,
                notif_type=NotificationType.PERSONA_SHARED,
                db_session=db_session,
                additional_data=PersonaSharedNotificationData(
                    persona_id=persona_id,
                ).model_dump(),
            )


@basic_router.delete("/{persona_id}")
def delete_persona(
    persona_id: int,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    mark_persona_as_deleted(
        persona_id=persona_id,
        user=user,
        db_session=db_session,
    )


@basic_router.get("/image-generation-tool")
def get_image_generation_tool(
    _: User
    | None = Depends(current_user),  # User param not used but kept for consistency
    db_session: Session = Depends(get_session),
) -> ImageGenerationToolStatus:  # Use bool instead of str for boolean values
    is_available = is_image_generation_available(db_session=db_session)
    return ImageGenerationToolStatus(is_available=is_available)


@basic_router.get("")
def list_personas(
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
    include_deleted: bool = False,
    persona_ids: list[int] = Query(None),
) -> list[PersonaSnapshot]:
    personas = get_personas(
        user=user,
        include_deleted=include_deleted,
        db_session=db_session,
        get_editable=False,
        joinedload_all=True,
    )

    if persona_ids:
        personas = [p for p in personas if p.id in persona_ids]

    # Filter out personas with unavailable tools
    personas = [
        p
        for p in personas
        if not (
            any(tool.in_code_tool_id == "ImageGenerationTool" for tool in p.tools)
            and not is_image_generation_available(db_session=db_session)
        )
    ]

    return [PersonaSnapshot.from_model(p) for p in personas]


@basic_router.get("/{persona_id}")
def get_persona(
    persona_id: int,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> PersonaSnapshot:
    return PersonaSnapshot.from_model(
        get_persona_by_id(
            persona_id=persona_id,
            user=user,
            db_session=db_session,
            is_for_edit=False,
        )
    )


@basic_router.get("/utils/prompt-explorer")
def build_final_template_prompt(
    system_prompt: str,
    task_prompt: str,
    retrieval_disabled: bool = False,
    _: User | None = Depends(current_user),
) -> PromptTemplateResponse:
    return PromptTemplateResponse(
        final_prompt_template=build_dummy_prompt(
            system_prompt=system_prompt,
            task_prompt=task_prompt,
            retrieval_disabled=retrieval_disabled,
        )
    )


class StarterMessage(BaseModel):
    name: str
    description: str
    message: str


def get_random_chunks_from_doc_sets(
    doc_sets: list[str], num_chunks: int, db_session: Session
) -> list[InferenceChunk]:
    # Get the document index
    curr_ind_name, sec_ind_name = get_both_index_names(db_session)
    document_index = get_default_document_index(curr_ind_name, sec_ind_name)

    # Create filters to only get chunks from specified document sets
    filters = IndexFilters(document_set=doc_sets, access_control_list=None)

    # Get random chunks directly from Vespa
    return document_index.random_retrieval(filters=filters, num_to_retrieve=num_chunks)


# Based on an assistant schema, generates 4 prompts
@basic_router.post("/assistant-prompt-refresh")
def build_assistant_prompts(
    generate_persona_prompt_request: GeneratePersonaPromptRequest,
    db_session: Session = Depends(get_session),
    _: User | None = Depends(current_user),
) -> list[StarterMessage]:
    print("generate_persona_prompt_request.document_set_ids")
    print(generate_persona_prompt_request.document_set_ids)
    base_prompt = (
        "Create a very short starter message for a chatbot based on the provided content. "
        "Ensure it includes a name and description, and invites user interaction. "
        "Name shuodl be name of the prompt, desciprtion of hte promtps and then the acutal message that is setn"
        + f"name {generate_persona_prompt_request.name}\n"
        + f"description: {generate_persona_prompt_request.description}"
    )
    _, fast_llm = get_default_llms(temperature=1.0)
    if (
        generate_persona_prompt_request.document_set_ids
        and len(generate_persona_prompt_request.document_set_ids) > 0
    ):
        document_sets = get_document_sets_by_ids(
            document_set_ids=generate_persona_prompt_request.document_set_ids,
            db_session=db_session,
        )
        chunks = get_random_chunks_from_doc_sets(
            doc_sets=[doc_set.name for doc_set in document_sets],
            num_chunks=4,
            db_session=db_session,
        )
        random_content = "".join([chunk.content for chunk in chunks])
        base_prompt += f'and the conntent it has access to is similar in ilk to """{random_content}"""'

    prompts: StarterMessage = []
    for _ in range(4):
        import json

        response = json.loads(
            fast_llm.invoke(
                base_prompt, structured_response_format=StarterMessage
            ).content
        )
        # Convert the LLM response into a StarterMessage object
        starter_message = StarterMessage(
            name=response["name"],
            description=response["description"],
            message=response["message"],
        )
        prompts.append(starter_message)

    return prompts

    # return build_assistant_prompts(assistant_schema=assistant_schema)
