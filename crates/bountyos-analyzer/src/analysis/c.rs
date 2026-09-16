use tree_sitter::{Node, Parser};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BufferDeclaration {
    pub name: String,
    pub size: Option<usize>,
    pub line: usize,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BufferCopyFact {
    pub function: String,
    pub destination: String,
    pub operation: String,
    pub source: String,
    pub destination_size: Option<usize>,
    pub line: usize,
}

pub fn find_unbounded_stack_copies(source: &str) -> Vec<BufferCopyFact> {
    let mut parser = Parser::new();

    let language: tree_sitter::Language = tree_sitter_c::LANGUAGE.into();
    parser
        .set_language(&language)
        .expect("failed to load C grammar");

    let Some(tree) = parser.parse(source, None) else {
        return Vec::new();
    };

    let mut declarations = Vec::new();
    collect_stack_buffers(tree.root_node(), source.as_bytes(), &mut declarations);

    let mut results = Vec::new();

    walk_calls(
        tree.root_node(),
        source.as_bytes(),
        None,
        &declarations,
        &mut results,
    );

    results
}

fn collect_stack_buffers(
    node: Node,
    source: &[u8],
    declarations: &mut Vec<BufferDeclaration>,
) {
    if node.kind() == "declaration" {
        if let Some(declaration) = parse_char_array(node, source) {
            declarations.push(declaration);
        }
    }

    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        collect_stack_buffers(child, source, declarations);
    }
}

fn parse_char_array(node: Node, source: &[u8]) -> Option<BufferDeclaration> {
    let type_node = node.child_by_field_name("type")?;

    if type_node.kind() != "primitive_type" {
        return None;
    }

    let type_text = type_node.utf8_text(source).ok()?;

    if type_text != "char" {
        return None;
    }

    let declarator = node.child_by_field_name("declarator")?;

    if declarator.kind() != "array_declarator" {
        return None;
    }

    let name_node = declarator.child_by_field_name("declarator")?;

    let name = name_node.utf8_text(source).ok()?.to_string();

    let size = declarator
        .child_by_field_name("size")
        .and_then(|size_node| {
            size_node
                .utf8_text(source)
                .ok()?
                .parse::<usize>()
                .ok()
        });

    Some(BufferDeclaration {
        name,
        size,
        line: node.start_position().row + 1,
    })
}

fn walk_calls(
    node: Node,
    source: &[u8],
    current_function: Option<String>,
    declarations: &[BufferDeclaration],
    results: &mut Vec<BufferCopyFact>,
) {
    let mut function = current_function;

    if node.kind() == "function_definition" {
        function = find_function_name(node, source);
    }

    if node.kind() == "call_expression" {
        if let Some(fact) =
            inspect_copy_call(node, source, function.as_deref(), declarations)
        {
            results.push(fact);
        }
    }

    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        walk_calls(
            child,
            source,
            function.clone(),
            declarations,
            results,
        );
    }
}

fn find_function_name(node: Node, source: &[u8]) -> Option<String> {
    let declarator = node.child_by_field_name("declarator")?;

    find_declarator_name(declarator, source)
}

fn find_declarator_name(node: Node, source: &[u8]) -> Option<String> {
    if node.kind() == "identifier" {
        return Some(node.utf8_text(source).ok()?.to_string());
    }

    let mut cursor = node.walk();

    for child in node.children(&mut cursor) {
        if let Some(name) = find_declarator_name(child, source) {
            return Some(name);
        }
    }

    None
}

fn inspect_copy_call(
    node: Node,
    source: &[u8],
    function: Option<&str>,
    declarations: &[BufferDeclaration],
) -> Option<BufferCopyFact> {
    let function_node = node.child_by_field_name("function")?;

    let name = function_node.utf8_text(source).ok()?;

    if name != "strcpy" && name != "strcat" {
        return None;
    }

    let arguments = node.child_by_field_name("arguments")?;

    let destination_node = arguments.named_child(0)?;

    let source_node = arguments.named_child(1)?;

    let destination = destination_node.utf8_text(source).ok()?.to_string();

    let source_argument = source_node.utf8_text(source).ok()?.to_string();

    let declaration = declarations
        .iter()
        .find(|decl| decl.name == destination)?;

    Some(BufferCopyFact {
        function: function.unwrap_or("<unknown>").to_string(),
        destination,
        operation: name.to_string(),
        source: source_argument,
        destination_size: declaration.size,
        line: node.start_position().row + 1,
    })
}
