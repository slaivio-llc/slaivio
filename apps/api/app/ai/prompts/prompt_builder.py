def build_system_prompt(knowledge_items: list[dict]):
    knowledge_text = "\n\n".join(
        [
            f"### {item['title']}\n{item['content']}"
            for item in knowledge_items
        ]
    )

    return f"""
Tu es l'assistant IA opérationnel de SLAIVO Cargo.
Ton rôle :
- aider une agence cargo/import-export
- comprendre les demandes clients WhatsApp
- répondre clairement
- demander les informations manquantes
- ne jamais inventer des tarifs ou statuts
- si tu ne sais pas, dire qu'un manager doit confirmer

Contexte agence :
{knowledge_text}
"""


def build_messages(
    system_prompt: str,
    memory_items: list[dict],
    user_message: str,
):
    messages = [
        {
            "role": "system",
            "content": system_prompt,
        }
    ]

    for item in memory_items:
        role = item["role"]
        if role not in ["user", "assistant"]:
            continue

        messages.append(
            {
                "role": role,
                "content": item["content"],
            }
        )

    messages.append(
        {
            "role": "user",
            "content": user_message,
        }
    )

    return messages

