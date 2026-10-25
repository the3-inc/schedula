FROM public.ecr.aws/lambda/python:3.14@sha256:fc4e15a5e09e2c9b6184810ea0fdc87afe1c1c734c98cbe27d739a35c3f15e7e
# shortcut: AWS の 3.14 イメージは 3.14.8 のため pip を修正、3.14.9 提供時に digest を更新する。
RUN pip install --no-cache-dir --upgrade "pip @ https://files.pythonhosted.org/packages/3f/06/3e4420302363fbb71be3c7f35ce042f54bfca330e3e66b3a2e3c4cca579f/pip-26.2.2-py3-none-any.whl#sha256=fd7f4dfa8190e014013b9f08f3e973f4e4c26ffd179a204895533a7254813a70" \
    && pip install --no-cache-dir uv==0.13.5
COPY pyproject.toml uv.lock README.md LICENSE THIRD_PARTY_NOTICES.md /tmp/project/
RUN cd /tmp/project && uv export --frozen --no-dev --no-emit-project -o /tmp/requirements.txt > /dev/null \
    && uv pip install --system --require-hashes -r /tmp/requirements.txt
COPY dist/*.whl /tmp/wheels/
RUN uv pip install --system --no-deps /tmp/wheels/*.whl
COPY web/ ${LAMBDA_TASK_ROOT}/web/
COPY examples/playground/lessons.json examples/playground/demand-adjustment.json examples/playground/consecutive-days.json examples/playground/manual-verify.json examples/playground/manual-verify.solution.json ${LAMBDA_TASK_ROOT}/examples/playground/
CMD ["web.handler.lambda_handler"]
