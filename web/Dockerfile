FROM public.ecr.aws/lambda/python:3.14@sha256:3e65cc23a6a51801f90c0a0a0a3561abfdedba6829ebe33507387982f5fbfb4e
RUN pip install --no-cache-dir uv==0.13.6
COPY pyproject.toml uv.lock README.md LICENSE THIRD_PARTY_NOTICES.md /tmp/project/
RUN cd /tmp/project && uv export --frozen --no-dev --no-emit-project -o /tmp/requirements.txt > /dev/null \
    && uv pip install --system --require-hashes -r /tmp/requirements.txt
COPY dist/*.whl /tmp/wheels/
RUN uv pip install --system --no-deps /tmp/wheels/*.whl
COPY web/ ${LAMBDA_TASK_ROOT}/web/
COPY examples/playground/lessons.json examples/playground/demand-adjustment.json examples/playground/consecutive-days.json examples/playground/manual-verify.json examples/playground/manual-verify.solution.json ${LAMBDA_TASK_ROOT}/examples/playground/
CMD ["web.handler.lambda_handler"]
