def render_template(
    body_text: str,
    variables: list[str],
):
    rendered = body_text

    for index, value in enumerate(
        variables,
        start=1,
    ):
        rendered = rendered.replace(
            f"{{{{{index}}}}}",
            str(value),
        )

    return rendered
