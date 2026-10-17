import os
from pathlib import Path
from dotenv import load_dotenv
from langchain_community.document_loaders import PyPDFLoader
from langchain_core.output_parsers import StrOutputParser
from langchain_core.prompts import PromptTemplate
from langchain_core.runnables import RunnableLambda, RunnableParallel, RunnablePassthrough
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_openrouter import ChatOpenRouter
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.documents import Document
from langchain_core.embeddings import Embeddings
from langchain_community.vectorstores import FAISS
from langchain_text_splitters import TextSplitter
from typing import List
from collections.abc import Sequence
from langchain_core.documents import Document


class AppResource:
    def __init__(self, splitter: TextSplitter, embedding_model: Embeddings) -> None:
        self.splitter = splitter
        self.embedding_model = embedding_model

    def create_vector_database(self, documents: List[Document]) -> FAISS:
        return FAISS.from_documents(
            documents=documents,
            embedding=self.embedding_model
        )

def merge_documents(docs: Sequence[Document]) -> str:
    return "\n\n".join(document.page_content for document in docs)


def main() -> None:
    project_dir = Path(__file__).resolve().parent
    load_dotenv(project_dir / ".env")

    query = input("Ask a question about the PDF: ").strip()
    if not query:
        print("Please enter a non-empty question.")
        return

    embedding_model_name = os.getenv(
        "HUGGINGFACE_EMBEDDING_MODEL",
        "sentence-transformers/all-MiniLM-L6-v2",
    )
    model_name = os.getenv(
        "OPENROUTER_MODEL",
        "nvidia/nemotron-3.5-super-vl:free",
    )

    resource = AppResource(
        RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=160),
        HuggingFaceEmbeddings(model_name=embedding_model_name),
    )

    loader = PyPDFLoader(str(project_dir / "Hacking.pdf"))
    documents = resource.splitter.split_documents(loader.load())
    vector_db = resource.create_vector_database(documents)
    retriever = vector_db.as_retriever(
        search_type="similarity",
        search_kwargs={"k": 3}
    )

    model = ChatOpenRouter(model=model_name)
    prompt = PromptTemplate(
        template=(
            "Answer the question using only the context below. "
            "If the context does not contain the answer, say \"I don't know.\"\n\n"
            "Context:\n{context}\n\n"
            "Question:\n{query}"
        ),
        input_variables=["context", "query"],
    )
    chain = (
        RunnableParallel(
            context=retriever | RunnableLambda(merge_documents),
            query=RunnablePassthrough(),
        )
        | prompt | model | StrOutputParser()
    )

    print(chain.invoke(query))


if __name__ == "__main__":
    main()
