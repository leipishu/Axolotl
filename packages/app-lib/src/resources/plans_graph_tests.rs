use super::*;

#[tokio::test]
async fn constraints_from_deeper_parents_reselect_the_shared_dependency_in_both_root_orders()
 {
    let mut a = release("root0000", "1", 'a');
    let mut b = release("parent00", "1", 'b');
    let mut c = release("child000", "1", 'c');
    let versions = vec![
        release("depend00", "1", 'd'),
        release("depend00", "2", 'e'),
        release("depend00", "3", 'f'),
    ];
    requires(&mut b, &c, ResourceDependencyKind::Required);
    for (root, constraint) in [(&mut a, ">=1"), (&mut c, "<3")] {
        root.artifacts[0].dependencies.push(ArtifactDependency {
            target: DependencyTarget::Resource {
                reference: ResourceRef::Source {
                    project: versions[0].reference.project.clone(),
                },
            },
            kind: ResourceDependencyKind::Required,
            version_constraint: Some(constraint.into()),
        });
    }
    for roots in [
        vec![selection("a", &a, None), selection("b", &b, None)],
        vec![selection("b", &b, None), selection("a", &a, None)],
    ] {
        let (_temp, service) = service(
            [vec![a.clone(), b.clone(), c.clone()], versions.clone()].concat(),
        )
        .await;
        let built = service
            .build_operation(
                draft(roots, ResourceOperationIntent::Install),
                &target(),
                &[],
                &CancellationToken::new(),
            )
            .await
            .unwrap();
        assert!(built.plan.issues.is_empty(), "{:?}", built.plan.issues);
        let d = built
            .plan
            .nodes
            .iter()
            .find(|node| {
                node.artifact.as_ref().is_some_and(|artifact| {
                    artifact.reference.release.project
                        == versions[0].reference.project
                })
            })
            .unwrap();
        assert_eq!(
            d.artifact.as_ref().unwrap().reference,
            versions[1].artifacts[0].reference
        );
        assert_eq!(
            built
                .plan
                .edges
                .iter()
                .filter(|edge| edge.child == d.id)
                .count(),
            2
        );
        service.cache().close().await;
    }
}

#[tokio::test]
async fn disabled_missing_and_outdated_dependencies_require_review_without_installing_an_extra_copy()
 {
    let mut a = release("root0000", "1", 'a');
    let old = release("depend00", "1", 'b');
    let current = release("depend00", "2", 'c');
    requires(&mut a, &current, ResourceDependencyKind::Required);
    let (_directory, service) =
        service(vec![a.clone(), old.clone(), current.clone()]).await;
    let mut disabled =
        installed(&current, "disabled", "mods/custom.jar.disabled");
    disabled.enabled = false;
    let mut missing = installed(&current, "missing", "mods/custom.jar");
    missing.missing = true;
    for entry in [
        disabled,
        missing,
        installed(&old, "outdated", "mods/custom.jar"),
    ] {
        let plan = service
            .build_operation(
                draft(
                    vec![selection("a", &a, None)],
                    ResourceOperationIntent::Install,
                ),
                &target(),
                &[entry.clone()],
                &CancellationToken::new(),
            )
            .await
            .unwrap()
            .plan;
        assert_eq!(plan.actions.len(), 1);
        assert!(
            plan.issues
                .iter()
                .any(|issue| issue.code == ResourceIssueCode::VersionConflict
                    && issue.blocking)
        );
        assert!(plan.nodes.iter().any(|node| {
            node.installed_entries.contains(&entry.entry_id)
                && matches!(
                    node.state,
                    DependencyNodeState::Disabled
                        | DependencyNodeState::Conflict
                )
        }));
    }
    let disabled = installed(&old, "disabled-root", "mods/custom.jar.disabled");
    let plan = service
        .build_operation(
            draft(
                vec![
                    selection("a", &a, None),
                    selection("disabled-root", &current, Some("disabled-root")),
                ],
                ResourceOperationIntent::Update,
            ),
            &target(),
            &[disabled],
            &CancellationToken::new(),
        )
        .await
        .unwrap()
        .plan;
    assert!(
        plan.issues
            .iter()
            .any(|issue| issue.code == ResourceIssueCode::VersionConflict
                && issue.blocking)
    );
    service.cache().close().await;
}

#[tokio::test]
async fn active_cycles_terminate_and_inactive_optional_closures_stay_unresolved()
 {
    let mut a = release("root0000", "1", 'a');
    let mut b = release("cycle000", "1", 'b');
    let mut c = release("option00", "1", 'c');
    let absent = release("absent00", "1", 'd');
    requires(&mut a, &b, ResourceDependencyKind::Required);
    requires(&mut b, &a, ResourceDependencyKind::Required);
    requires(&mut a, &c, ResourceDependencyKind::Optional);
    requires(&mut c, &absent, ResourceDependencyKind::Required);
    let (_directory, service) = service(vec![a.clone(), b, c]).await;
    let initial = service
        .build_operation(
            draft(
                vec![selection("a", &a, None)],
                ResourceOperationIntent::Install,
            ),
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(initial.plan.actions.len(), 2);
    assert!(initial.plan.issues.is_empty());
    assert_eq!(initial.plan.nodes.len(), 3);
    let candidate = initial.candidates[0].clone();
    let failed = service
        .revise_operation(
            initial.clone(),
            vec![ResourcePlanDecision::AddOptional {
                node_id: candidate.id,
            }],
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await;
    assert!(failed.is_err());
    assert_eq!(initial.plan.active_roots.len(), 1);
    assert_eq!(initial.plan.actions.len(), 2);
    service.cache().close().await;
}

#[tokio::test]
async fn optional_revisions_keep_independent_roots_and_cancellation_leaves_previous_choices()
 {
    let mut a = release("root0000", "1", 'a');
    let mut b = release("option00", "1", 'b');
    let c = release("shared00", "1", 'c');
    requires(&mut a, &b, ResourceDependencyKind::Optional);
    requires(&mut b, &c, ResourceDependencyKind::Required);
    let (_directory, service) = service(vec![a.clone(), b, c.clone()]).await;
    let initial = service
        .build_operation(
            draft(
                vec![
                    selection("a", &a, None),
                    selection("independent-c", &c, None),
                ],
                ResourceOperationIntent::Install,
            ),
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    let id = initial.candidates[0].id.clone();
    let canceled = CancellationToken::new();
    canceled.cancel();
    assert!(matches!(
        service
            .revise_operation(
                initial.clone(),
                vec![ResourcePlanDecision::AddOptional {
                    node_id: id.clone()
                }],
                &target(),
                &[],
                &canceled
            )
            .await,
        Err(ResourceError::Canceled)
    ));
    assert_eq!(initial.plan.revision, 1);
    let activated = service
        .revise_operation(
            initial,
            vec![ResourcePlanDecision::AddOptional {
                node_id: id.clone(),
            }],
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(activated.plan.revision, 2);
    assert_eq!(activated.plan.actions.len(), 3);
    let removed = service
        .revise_operation(
            activated,
            vec![ResourcePlanDecision::RemoveOptional { node_id: id }],
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap();
    assert_eq!(removed.plan.actions.len(), 2);
    assert_eq!(removed.plan.revision, 3);
    assert!(
        removed
            .plan
            .active_roots
            .iter()
            .any(|id| id.as_str() == "independent-c")
    );
    assert!(
        removed
            .plan
            .actions
            .iter()
            .any(|action| action.target.reference == c.artifacts[0].reference)
    );
    service.cache().close().await;
}

#[tokio::test]
async fn multiple_parent_constraints_select_a_common_release_and_report_empty_intersections()
 {
    let mut a = release("root0000", "1", 'a');
    let mut b = release("parent00", "1", 'b');
    let versions = vec![
        release("depend00", "1", 'c'),
        release("depend00", "2", 'd'),
        release("depend00", "3", 'e'),
    ];
    for (root, constraint) in [(&mut a, ">=1"), (&mut b, "<3")] {
        root.artifacts[0].dependencies.push(ArtifactDependency {
            target: DependencyTarget::Resource {
                reference: ResourceRef::Source {
                    project: versions[0].reference.project.clone(),
                },
            },
            kind: ResourceDependencyKind::Required,
            version_constraint: Some(constraint.into()),
        });
    }
    let (_directory, first_service) =
        service([vec![a.clone(), b.clone()], versions.clone()].concat()).await;
    let plan = first_service
        .build_operation(
            draft(
                vec![selection("a", &a, None), selection("b", &b, None)],
                ResourceOperationIntent::Install,
            ),
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap()
        .plan;
    assert!(plan.issues.is_empty(), "{:?}", plan.issues);
    let dependency = plan
        .nodes
        .iter()
        .find(|node| node.id.as_str().starts_with("dependency:"))
        .unwrap();
    assert_eq!(
        dependency.artifact.as_ref().unwrap().reference,
        versions[1].artifacts[0].reference
    );
    first_service.cache().close().await;
    b.artifacts[0].dependencies[0].version_constraint = Some("<1".into());
    let (_directory, service) =
        service([vec![a.clone(), b.clone()], versions].concat()).await;
    let plan = service
        .build_operation(
            draft(
                vec![selection("a", &a, None), selection("b", &b, None)],
                ResourceOperationIntent::Install,
            ),
            &target(),
            &[],
            &CancellationToken::new(),
        )
        .await
        .unwrap()
        .plan;
    assert!(
        plan.issues
            .iter()
            .any(|issue| issue.code == ResourceIssueCode::VersionConflict
                && issue.blocking)
    );
    service.cache().close().await;
}

#[tokio::test]
async fn fixed_and_project_only_parent_requirements_share_the_fixed_release_in_both_orders()
 {
    let mut a = release("root0000", "1", 'a');
    let mut b = release("parent00", "1", 'b');
    let old = release("depend00", "1", 'c');
    let new = release("depend00", "2", 'd');
    a.artifacts[0].dependencies.push(ArtifactDependency {
        target: DependencyTarget::Resource {
            reference: ResourceRef::Source {
                project: old.reference.project.clone(),
            },
        },
        kind: ResourceDependencyKind::Required,
        version_constraint: None,
    });
    requires(&mut b, &old, ResourceDependencyKind::Required);
    let (_directory, service) =
        service(vec![a.clone(), b.clone(), old.clone(), new]).await;
    for selections in [
        vec![selection("a", &a, None), selection("b", &b, None)],
        vec![selection("b", &b, None), selection("a", &a, None)],
    ] {
        let plan = service
            .build_operation(
                draft(selections, ResourceOperationIntent::Install),
                &target(),
                &[],
                &CancellationToken::new(),
            )
            .await
            .unwrap()
            .plan;
        assert!(plan.issues.is_empty(), "{:?}", plan.issues);
        assert_eq!(plan.actions.len(), 3);
        assert!(plan.actions.iter().any(
            |action| action.target.reference == old.artifacts[0].reference
        ));
    }
    service.cache().close().await;
}
